#!/usr/bin/env node
/**
 * /scripts/prepare-car.mjs
 *
 * Repeatable 3D Car Normalization, Rigging, Measurement & Optimization Pipeline:
 * 1. Reads /public/hero/hero-car-original.glb (2020 Audi RS7 Sportback by Ddiaz Design).
 * 2. Bakes the Sketchfab root centimeter scale (0.01) into meters and verifies real-world
 *    Audi RS7 Sportback (C8) dimensions (5.009 m length x 2.122 m width across mirrors x 1.428 m height).
 * 3. Centers the origin (0, 0, 0) at the ground-contact center between the wheels with
 *    forward = +Z, up = +Y, and wheel bottoms sitting at y = 0.0000 m.
 * 4. Removes any non-car nodes (cameras, lights, ground, pedestal, manufacturer license plate text)
 *    so the license plate area is plain/blank while keeping brand badges.
 * 5. Splits and merges primitives into the exact required named hierarchy:
 *    - car_body
 *    - steer_FL (pivot at front-left wheel center) -> wheel_FL (centered at (0,0,0) for pure X-axis rolling)
 *    - steer_FR (pivot at front-right wheel center) -> wheel_FR (centered at (0,0,0) for pure X-axis rolling)
 *    - wheel_RL (pivot at rear-left wheel center)
 *    - wheel_RR (pivot at rear-right wheel center)
 *    - calipers (front-left/right calipers parented under steer_FL/steer_FR so they steer with the knuckles,
 *                plus rear calipers under calipers)
 *    - glass
 *    - headlights
 *    - drl
 *    - taillights
 * 6. Separates tire rubber vs metallic rim geometry inside each wheel so runtime materials can
 *    style tires (roughness 0.75, #0a0a0b) and rims (dark metal, roughness 0.35) independently.
 * 7. Separates headlights, signature LED DRLs, taillights, and dark lamp housings from Light_Geo_lodA.
 * 8. Writes measured geometry to /lib/car-meta.generated.json.
 * 9. Optimizes with @gltf-transform (dedup, prune, weld, resample, Draco compression, WebP textures)
 *    and outputs:
 *    - /public/models/hero-car.glb (desktop: textures max 2048, <= 6 MB, <= 300k triangles)
 *    - /public/models/hero-car-lite.glb (mobile: simplified ~50% triangles, textures max 1024, <= 2.5 MB, <= 120k triangles, interior removed)
 * 10. Copies self-hosted Draco decoder files to /public/draco/.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import draco3d from "draco3dgltf";
import { MeshoptSimplifier } from "meshoptimizer";
import { Document, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import {
  dedup,
  prune,
  weld,
  resample,
  draco,
  simplify,
  textureCompress,
} from "@gltf-transform/functions";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const INPUT_GLB = path.join(ROOT, "public/hero/hero-car-original.glb");
const OUT_DIR = path.join(ROOT, "public/models");
const OUT_DESKTOP_GLB = path.join(OUT_DIR, "hero-car.glb");
const OUT_MOBILE_GLB = path.join(OUT_DIR, "hero-car-lite.glb");
const OUT_META_JSON = path.join(ROOT, "lib/car-meta.generated.json");
const DRACO_OUT_DIR = path.join(ROOT, "public/draco");

// Real-world target length for the 2020 Audi RS7 Sportback (C8) is 5.009 m (5009 mm).
const TARGET_LENGTH_METERS = 5.009;

// 4x4 Column-Major Matrix Helpers
function mat4Identity() {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

function mat4Mul(a, b) {
  const out = new Array(16).fill(0);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        sum += a[k * 4 + row] * b[col * 4 + k];
      }
      out[col * 4 + row] = sum;
    }
  }
  return out;
}

function trsToMat4(t, r, s) {
  const [x, y, z, w] = r;
  const x2 = x + x,
    y2 = y + y,
    z2 = z + z;
  const xx = x * x2,
    xy = x * y2,
    xz = x * z2;
  const yy = y * y2,
    yz = y * z2,
    zz = z * z2;
  const wx = w * x2,
    wy = w * y2,
    wz = w * z2;
  const [sx, sy, sz] = s;
  return [
    (1 - (yy + zz)) * sx,
    (xy + wz) * sx,
    (xz - wy) * sx,
    0,
    (xy - wz) * sy,
    (1 - (xx + zz)) * sy,
    (yz + wx) * sy,
    0,
    (xz + wy) * sz,
    (yz - wx) * sz,
    (1 - (xx + yy)) * sz,
    0,
    t[0],
    t[1],
    t[2],
    1,
  ];
}

function getNodeLocalMatrix(node) {
  const mat = node.getMatrix();
  // gltf-transform node.getMatrix() always returns a 16-element matrix computed from TRS or matrix
  return Array.from(mat);
}

function transformPoint(m, p) {
  const [x, y, z] = p;
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}

function transformNormal(m, n) {
  const [x, y, z] = n;
  // Upper-left 3x3 (valid for uniform scale + rotation)
  const nx = m[0] * x + m[4] * y + m[8] * z;
  const ny = m[1] * x + m[5] * y + m[9] * z;
  const nz = m[2] * x + m[6] * y + m[10] * z;
  const len = Math.hypot(nx, ny, nz) || 1;
  return [nx / len, ny / len, nz / len];
}

/**
 * Extracts world-transformed triangles from a gltf-transform Primitive.
 */
function extractWorldGeometry(prim, worldMat, scaleFactor, offsetVec) {
  const posAcc = prim.getAttribute("POSITION");
  if (!posAcc) return null;

  const normAcc = prim.getAttribute("NORMAL");
  const uvAcc = prim.getAttribute("TEXCOORD_0");
  const idxAcc = prim.getIndices();

  const vertCount = posAcc.getCount();
  const positions = new Float32Array(vertCount * 3);
  const normals = normAcc ? new Float32Array(vertCount * 3) : null;
  const uvs = uvAcc ? new Float32Array(vertCount * 2) : null;

  const tmp = [0, 0, 0];
  const tmp2 = [0, 0, 0];

  for (let i = 0; i < vertCount; i++) {
    posAcc.getElement(i, tmp);
    const wp = transformPoint(worldMat, tmp);
    positions[i * 3 + 0] = wp[0] * scaleFactor + offsetVec[0];
    positions[i * 3 + 1] = wp[1] * scaleFactor + offsetVec[1];
    positions[i * 3 + 2] = wp[2] * scaleFactor + offsetVec[2];

    if (normals && normAcc) {
      normAcc.getElement(i, tmp);
      const wn = transformNormal(worldMat, tmp);
      normals[i * 3 + 0] = wn[0];
      normals[i * 3 + 1] = wn[1];
      normals[i * 3 + 2] = wn[2];
    }

    if (uvs && uvAcc) {
      uvAcc.getElement(i, tmp2);
      uvs[i * 2 + 0] = tmp2[0];
      uvs[i * 2 + 1] = tmp2[1];
    }
  }

  let indices;
  if (idxAcc) {
    const icnt = idxAcc.getCount();
    indices = new Uint32Array(icnt);
    for (let i = 0; i < icnt; i++) {
      indices[i] = idxAcc.getScalar(i);
    }
  } else {
    indices = new Uint32Array(vertCount);
    for (let i = 0; i < vertCount; i++) indices[i] = i;
  }

  return {
    positions,
    normals,
    uvs,
    indices,
    material: prim.getMaterial(),
  };
}

/**
 * Merges an array of extracted geometry chunks sharing a single material into one Primitive
 * on the target Document. Optionally shifts positions by `pivotOffset` (e.g., to center a wheel at (0,0,0)).
 */
function buildMergedPrimitive(
  outDoc,
  outBuf,
  chunks,
  outMaterial,
  pivotOffset = [0, 0, 0]
) {
  if (!chunks.length) return null;

  let totalVerts = 0;
  let totalIdx = 0;
  let hasNormals = true;
  let hasUvs = true;

  for (const ch of chunks) {
    totalVerts += ch.positions.length / 3;
    totalIdx += ch.indices.length;
    if (!ch.normals) hasNormals = false;
    if (!ch.uvs) hasUvs = false;
  }

  if (totalVerts === 0 || totalIdx === 0) return null;

  const mergedPos = new Float32Array(totalVerts * 3);
  const mergedNorm = hasNormals ? new Float32Array(totalVerts * 3) : null;
  const mergedUv = hasUvs ? new Float32Array(totalVerts * 2) : null;
  const mergedIdx = new Uint32Array(totalIdx);

  let vOffset = 0;
  let iOffset = 0;
  const [px, py, pz] = pivotOffset;

  for (const ch of chunks) {
    const vCount = ch.positions.length / 3;
    for (let i = 0; i < vCount; i++) {
      mergedPos[(vOffset + i) * 3 + 0] = ch.positions[i * 3 + 0] - px;
      mergedPos[(vOffset + i) * 3 + 1] = ch.positions[i * 3 + 1] - py;
      mergedPos[(vOffset + i) * 3 + 2] = ch.positions[i * 3 + 2] - pz;
    }
    if (mergedNorm && ch.normals) {
      mergedNorm.set(ch.normals, vOffset * 3);
    }
    if (mergedUv && ch.uvs) {
      mergedUv.set(ch.uvs, vOffset * 2);
    }
    for (let i = 0; i < ch.indices.length; i++) {
      mergedIdx[iOffset + i] = ch.indices[i] + vOffset;
    }
    vOffset += vCount;
    iOffset += ch.indices.length;
  }

  const posAcc = outDoc
    .createAccessor()
    .setType("VEC3")
    .setArray(mergedPos)
    .setBuffer(outBuf);
  const idxAcc = outDoc
    .createAccessor()
    .setType("SCALAR")
    .setArray(mergedIdx)
    .setBuffer(outBuf);

  const prim = outDoc
    .createPrimitive()
    .setAttribute("POSITION", posAcc)
    .setIndices(idxAcc)
    .setMaterial(outMaterial);

  if (mergedNorm) {
    const normAcc = outDoc
      .createAccessor()
      .setType("VEC3")
      .setArray(mergedNorm)
      .setBuffer(outBuf);
    prim.setAttribute("NORMAL", normAcc);
  }
  if (mergedUv) {
    const uvAcc = outDoc
      .createAccessor()
      .setType("VEC2")
      .setArray(mergedUv)
      .setBuffer(outBuf);
    prim.setAttribute("TEXCOORD_0", uvAcc);
  }

  return prim;
}

/**
 * Filters a single geometry chunk by triangle predicate, returning a new chunk with only matching triangles.
 */
function filterChunkTriangles(chunk, predicate) {
  const { positions, normals, uvs, indices, material } = chunk;
  const keptTris = [];

  for (let i = 0; i < indices.length; i += 3) {
    const i0 = indices[i];
    const i1 = indices[i + 1];
    const i2 = indices[i + 2];

    const p0 = [
      positions[i0 * 3],
      positions[i0 * 3 + 1],
      positions[i0 * 3 + 2],
    ];
    const p1 = [
      positions[i1 * 3],
      positions[i1 * 3 + 1],
      positions[i1 * 3 + 2],
    ];
    const p2 = [
      positions[i2 * 3],
      positions[i2 * 3 + 1],
      positions[i2 * 3 + 2],
    ];

    const uv0 = uvs ? [uvs[i0 * 2], uvs[i0 * 2 + 1]] : [0, 0];
    const uv1 = uvs ? [uvs[i1 * 2], uvs[i1 * 2 + 1]] : [0, 0];
    const uv2 = uvs ? [uvs[i2 * 2], uvs[i2 * 2 + 1]] : [0, 0];

    if (predicate(p0, p1, p2, uv0, uv1, uv2)) {
      keptTris.push(i0, i1, i2);
    }
  }

  if (keptTris.length === 0) return null;

  // Compact vertex buffer to only referenced vertices
  const oldToNew = new Map();
  const newIndices = new Uint32Array(keptTris.length);
  let nextVert = 0;

  for (let i = 0; i < keptTris.length; i++) {
    const oldIdx = keptTris[i];
    let newIdx = oldToNew.get(oldIdx);
    if (newIdx === undefined) {
      newIdx = nextVert++;
      oldToNew.set(oldIdx, newIdx);
    }
    newIndices[i] = newIdx;
  }

  const newPos = new Float32Array(nextVert * 3);
  const newNorm = normals ? new Float32Array(nextVert * 3) : null;
  const newUv = uvs ? new Float32Array(nextVert * 2) : null;

  for (const [oldIdx, newIdx] of oldToNew.entries()) {
    newPos[newIdx * 3 + 0] = positions[oldIdx * 3 + 0];
    newPos[newIdx * 3 + 1] = positions[oldIdx * 3 + 1];
    newPos[newIdx * 3 + 2] = positions[oldIdx * 3 + 2];
    if (newNorm && normals) {
      newNorm[newIdx * 3 + 0] = normals[oldIdx * 3 + 0];
      newNorm[newIdx * 3 + 1] = normals[oldIdx * 3 + 1];
      newNorm[newIdx * 3 + 2] = normals[oldIdx * 3 + 2];
    }
    if (newUv && uvs) {
      newUv[newIdx * 2 + 0] = uvs[oldIdx * 2 + 0];
      newUv[newIdx * 2 + 1] = uvs[oldIdx * 2 + 1];
    }
  }

  return {
    positions: newPos,
    normals: newNorm,
    uvs: newUv,
    indices: newIndices,
    material,
  };
}

function computeChunksBounds(chunks) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const ch of chunks) {
    const p = ch.positions;
    for (let i = 0; i < p.length; i += 3) {
      if (p[i] < min[0]) min[0] = p[i];
      if (p[i] > max[0]) max[0] = p[i];
      if (p[i + 1] < min[1]) min[1] = p[i + 1];
      if (p[i + 1] > max[1]) max[1] = p[i + 1];
      if (p[i + 2] < min[2]) min[2] = p[i + 2];
      if (p[i + 2] > max[2]) max[2] = p[i + 2];
    }
  }
  return {
    min,
    max,
    center: [
      (min[0] + max[0]) / 2,
      (min[1] + max[1]) / 2,
      (min[2] + max[2]) / 2,
    ],
    size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]],
  };
}

async function copyDracoDecoderFiles() {
  fs.mkdirSync(DRACO_OUT_DIR, { recursive: true });
  const srcDir = path.join(
    ROOT,
    "node_modules/three/examples/jsm/libs/draco/gltf"
  );
  const files = [
    "draco_decoder.js",
    "draco_decoder.wasm",
    "draco_wasm_wrapper.js",
  ];
  for (const f of files) {
    fs.copyFileSync(path.join(srcDir, f), path.join(DRACO_OUT_DIR, f));
  }
  console.log(`[prepare-car] Copied self-hosted Draco decoder to /public/draco/`);
}

async function main() {
  console.log(`[prepare-car] Loading ${INPUT_GLB}...`);
  await MeshoptSimplifier.ready;
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      "draco3d.decoder": await draco3d.createDecoderModule(),
      "draco3d.encoder": await draco3d.createEncoderModule(),
    });

  const srcDoc = await io.read(INPUT_GLB);
  const srcRoot = srcDoc.getRoot();
  const srcScene = srcRoot.listScenes()[0];

  // 1. First pass: compute raw world bounds of the entire car to determine scale factor to meters
  const rawMin = [Infinity, Infinity, Infinity];
  const rawMax = [-Infinity, -Infinity, -Infinity];

  function walkRawBounds(node, parentMat) {
    const worldMat = mat4Mul(parentMat, getNodeLocalMatrix(node));
    const mesh = node.getMesh();
    if (mesh) {
      for (const prim of mesh.listPrimitives()) {
        const posAcc = prim.getAttribute("POSITION");
        if (!posAcc) continue;
        const tmp = [0, 0, 0];
        for (let i = 0; i < posAcc.getCount(); i++) {
          posAcc.getElement(i, tmp);
          const wp = transformPoint(worldMat, tmp);
          for (let k = 0; k < 3; k++) {
            if (wp[k] < rawMin[k]) rawMin[k] = wp[k];
            if (wp[k] > rawMax[k]) rawMax[k] = wp[k];
          }
        }
      }
    }
    for (const child of node.listChildren()) {
      walkRawBounds(child, worldMat);
    }
  }

  for (const rootNode of srcScene.listChildren()) {
    walkRawBounds(rootNode, mat4Identity());
  }

  const rawLengthZ = rawMax[2] - rawMin[2];
  // Rescale from Sketchfab's 0.01x centimeter export (0.0501 m) to exact real-world meters (5.009 m)
  const scaleToMeters = TARGET_LENGTH_METERS / rawLengthZ;
  console.log(
    `[prepare-car] Raw length Z = ${rawLengthZ.toFixed(5)} -> applying scaleFactor = ${scaleToMeters.toFixed(4)} to reach ${TARGET_LENGTH_METERS} m`
  );

  // 2. Second pass: extract all subtrees in meters (without centering offset yet) so we can find exact wheel centers & lowest tire contact Y
  function collectSubtreeChunks(startNode, parentMat, scaleFactor, offsetVec = [0, 0, 0]) {
    const chunks = [];
    function walk(n, pMat) {
      const wMat = mat4Mul(pMat, getNodeLocalMatrix(n));
      const mesh = n.getMesh();
      if (mesh) {
        for (const prim of mesh.listPrimitives()) {
          const ch = extractWorldGeometry(prim, wMat, scaleFactor, offsetVec);
          if (ch) chunks.push(ch);
        }
      }
      for (const c of n.listChildren()) {
        walk(c, wMat);
      }
    }
    walk(startNode, parentMat);
    return chunks;
  }

  // Locate the top-level functional groups under RootNode
  const allNodes = srcRoot.listNodes();
  const findNodeByName = (substr) =>
    allNodes.find((n) => (n.getName() || "").includes(substr));

  // Build world matrices for every node in srcDoc
  const nodeWorldMats = new Map();
  function cacheWorldMats(node, parentMat) {
    const wMat = mat4Mul(parentMat, getNodeLocalMatrix(node));
    nodeWorldMats.set(node, wMat);
    for (const c of node.listChildren()) {
      cacheWorldMats(c, wMat);
    }
  }
  for (const rn of srcScene.listChildren()) {
    cacheWorldMats(rn, mat4Identity());
  }

  const getParentWorldMat = (node) => {
    // Find parent node
    for (const candidate of allNodes) {
      if (candidate.listChildren().includes(node)) {
        return nodeWorldMats.get(candidate) || mat4Identity();
      }
    }
    return mat4Identity();
  };

  const nodeWheelFL = findNodeByName("3DWheel Front L");
  const nodeWheelFR = findNodeByName("3DWheel Front R");
  const nodeWheelRL = findNodeByName("3DWheel Rear L");
  const nodeWheelRR = findNodeByName("3DWheel Rear R");

  if (!nodeWheelFL || !nodeWheelFR || !nodeWheelRL || !nodeWheelRR) {
    throw new Error("Missing one or more separate wheel nodes in GLB!");
  }

  const rawChunksFL = collectSubtreeChunks(
    nodeWheelFL,
    getParentWorldMat(nodeWheelFL),
    scaleToMeters
  );
  const rawChunksFR = collectSubtreeChunks(
    nodeWheelFR,
    getParentWorldMat(nodeWheelFR),
    scaleToMeters
  );
  const rawChunksRL = collectSubtreeChunks(
    nodeWheelRL,
    getParentWorldMat(nodeWheelRL),
    scaleToMeters
  );
  const rawChunksRR = collectSubtreeChunks(
    nodeWheelRR,
    getParentWorldMat(nodeWheelRR),
    scaleToMeters
  );

  const bFL0 = computeChunksBounds(rawChunksFL);
  const bFR0 = computeChunksBounds(rawChunksFR);
  const bRL0 = computeChunksBounds(rawChunksRL);
  const bRR0 = computeChunksBounds(rawChunksRR);

  // Ground contact Y is the lowest point of the 4 tires
  const lowestWheelY = Math.min(
    bFL0.min[1],
    bFR0.min[1],
    bRL0.min[1],
    bRR0.min[1]
  );
  // Ground-contact center X and Z between the 4 wheels
  const wheelMidX =
    (bFL0.center[0] + bFR0.center[0] + bRL0.center[0] + bRR0.center[0]) / 4;
  const wheelMidZ =
    (bFL0.center[2] + bFR0.center[2] + bRL0.center[2] + bRR0.center[2]) / 4;

  const normOffset = [-wheelMidX, -lowestWheelY, -wheelMidZ];
  console.log(
    `[prepare-car] Centering offset (meters): [${normOffset.map((v) => v.toFixed(4)).join(", ")}] so wheel bottoms touch y = 0.0000 and origin sits at ground-contact center between wheels.`
  );

  // Re-collect wheel chunks with exact normalization offset
  const chunksFL = collectSubtreeChunks(
    nodeWheelFL,
    getParentWorldMat(nodeWheelFL),
    scaleToMeters,
    normOffset
  );
  const chunksFR = collectSubtreeChunks(
    nodeWheelFR,
    getParentWorldMat(nodeWheelFR),
    scaleToMeters,
    normOffset
  );
  const chunksRL = collectSubtreeChunks(
    nodeWheelRL,
    getParentWorldMat(nodeWheelRL),
    scaleToMeters,
    normOffset
  );
  const chunksRR = collectSubtreeChunks(
    nodeWheelRR,
    getParentWorldMat(nodeWheelRR),
    scaleToMeters,
    normOffset
  );

  const bFL = computeChunksBounds(chunksFL);
  const bFR = computeChunksBounds(chunksFR);
  const bRL = computeChunksBounds(chunksRL);
  const bRR = computeChunksBounds(chunksRR);

  // Separate each wheel's chunks into TIRE vs RIM so runtime materials can color tires (#0a0a0b, roughness 0.75) and rims (dark metal, roughness 0.35)
  // In the RS7 wheel texture (img_34), tire tread/sidewall meshes have avgUV.u > 0.75 and radial extent reaching the outer radius (~0.365 m),
  // whereas metallic rim spokes/barrel/center-cap have avgUV.u <= 0.75 or radius < 0.295 m.
  function splitWheelTireAndRim(chunks, wheelCenter) {
    const tireChunks = [];
    const rimChunks = [];
    const [cx, cy, cz] = wheelCenter;

    for (const ch of chunks) {
      const pos = ch.positions;
      const uv = ch.uvs;
      const vCount = pos.length / 3;
      let maxR = 0;
      let sumU = 0;
      let sumV = 0;

      for (let i = 0; i < vCount; i++) {
        const dy = pos[i * 3 + 1] - cy;
        const dz = pos[i * 3 + 2] - cz;
        const r = Math.hypot(dy, dz);
        if (r > maxR) maxR = r;
        if (uv) {
          sumU += uv[i * 2 + 0];
          sumV += uv[i * 2 + 1];
        }
      }
      const avgU = uv ? sumU / vCount : 0;
      const avgV = uv ? sumV / vCount : 0;

      // Outer tire tread & sidewall blocks sit at maxR > 0.335m (or UV in bottom-right tire tread island u>0.75, v>0.70)
      const isTire =
        maxR > 0.335 || (avgU > 0.75 && avgV > 0.7);
      if (isTire) {
        tireChunks.push(ch);
      } else {
        rimChunks.push(ch);
      }
    }
    return { tireChunks, rimChunks };
  }

  const splitFL = splitWheelTireAndRim(chunksFL, bFL.center);
  const splitFR = splitWheelTireAndRim(chunksFR, bFR.center);
  const splitRL = splitWheelTireAndRim(chunksRL, bRL.center);
  const splitRR = splitWheelTireAndRim(chunksRR, bRR.center);

  // Collect Calipers (front left, front right, rear left, rear right)
  const nodeCalFL = findNodeByName("Calliper Front L");
  const nodeCalFR = findNodeByName("Calliper Front R");
  const nodeCalRL = findNodeByName("Calliper Rear L");
  const nodeCalRR = findNodeByName("Calliper Rear R");

  const calChunksFL = nodeCalFL
    ? collectSubtreeChunks(nodeCalFL, getParentWorldMat(nodeCalFL), scaleToMeters, normOffset)
    : [];
  const calChunksFR = nodeCalFR
    ? collectSubtreeChunks(nodeCalFR, getParentWorldMat(nodeCalFR), scaleToMeters, normOffset)
    : [];
  const calChunksRL = nodeCalRL
    ? collectSubtreeChunks(nodeCalRL, getParentWorldMat(nodeCalRL), scaleToMeters, normOffset)
    : [];
  const calChunksRR = nodeCalRR
    ? collectSubtreeChunks(nodeCalRR, getParentWorldMat(nodeCalRR), scaleToMeters, normOffset)
    : [];

  // Collect Glass (exterior windows, excludes rear red reflector phong1 which goes to taillights, and excludes interior mirror glass in lite build)
  const nodeWindow = findNodeByName("Window_Geo_lodA");
  const nodeWindowInside = findNodeByName("WindowInside_Geo_lodA");
  const rawWindowChunks = nodeWindow
    ? collectSubtreeChunks(nodeWindow, getParentWorldMat(nodeWindow), scaleToMeters, normOffset)
    : [];
  const glassChunks = [];
  const rearReflectorGlassChunks = [];
  for (const ch of rawWindowChunks) {
    const matName = ch.material ? ch.material.getName() : "";
    if (matName.includes("phong1")) {
      // Rear red tail-light glass cover (z ~ -2.35 m)
      rearReflectorGlassChunks.push(ch);
    } else {
      glassChunks.push(ch);
    }
  }
  if (nodeWindowInside) {
    glassChunks.push(
      ...collectSubtreeChunks(
        nodeWindowInside,
        getParentWorldMat(nodeWindowInside),
        scaleToMeters,
        normOffset
      )
    );
  }

  // Collect and split Light_Geo_lodA into:
  // - headlights (front main projector lamps, z > 1.5 m)
  // - drl (front signature daytime running light bars, z > 1.5 m)
  // - taillights (rear LED light bar & tail clusters, z < -1.5 m)
  // - lightHousingChunks (dark internal headlight/taillight casings, merged into car_body)
  const nodeLight = findNodeByName("Light_Geo_lodA");
  const rawLightChunks = nodeLight
    ? collectSubtreeChunks(nodeLight, getParentWorldMat(nodeLight), scaleToMeters, normOffset)
    : [];

  const headlightChunks = [];
  const drlChunks = [];
  const taillightChunks = [...rearReflectorGlassChunks];
  const lightHousingChunks = [];

  for (const ch of rawLightChunks) {
    // 1. Front DRL signature strips: z > 1.5 and UV in high-emission metallic/LED strip islands (v >= 0.935 or u in [0.035..0.065] where blue/white LED strips live)
    const drlPart = filterChunkTriangles(
      ch,
      (p0, p1, p2, uv0, uv1, uv2) => {
        const cz = (p0[2] + p1[2] + p2[2]) / 3;
        if (cz <= 1.5) return false;
        const cu = (((uv0[0] + uv1[0] + uv2[0]) / 3) % 1 + 1) % 1;
        const cv = (((uv0[1] + uv1[1] + uv2[1]) / 3) % 1 + 1) % 1;
        return cv >= 0.935 || (cu >= 0.035 && cu <= 0.075 && cv >= 0.89);
      }
    );
    if (drlPart) drlChunks.push(drlPart);

    // 2. Front Headlight main projector optics: z > 1.5 and UV outside the dark housing (or inner projector islands)
    const hlPart = filterChunkTriangles(
      ch,
      (p0, p1, p2, uv0, uv1, uv2) => {
        const cz = (p0[2] + p1[2] + p2[2]) / 3;
        if (cz <= 1.5) return false;
        const cu = (((uv0[0] + uv1[0] + uv2[0]) / 3) % 1 + 1) % 1;
        const cv = (((uv0[1] + uv1[1] + uv2[1]) / 3) % 1 + 1) % 1;
        const isDrl =
          cv >= 0.935 || (cu >= 0.035 && cu <= 0.075 && cv >= 0.89);
        if (isDrl) return false;
        // Main projector reflectors & lenses sit at v < 0.88 or u > 0.08 or outer lamp cluster
        const isDarkCasing = cu < 0.035 && cv >= 0.89 && cv < 0.935;
        return !isDarkCasing;
      }
    );
    if (hlPart) headlightChunks.push(hlPart);

    // 3. Front Dark Headlight Casing -> car_body
    const frontCasingPart = filterChunkTriangles(
      ch,
      (p0, p1, p2, uv0, uv1, uv2) => {
        const cz = (p0[2] + p1[2] + p2[2]) / 3;
        if (cz <= 1.5) return false;
        const cu = (((uv0[0] + uv1[0] + uv2[0]) / 3) % 1 + 1) % 1;
        const cv = (((uv0[1] + uv1[1] + uv2[1]) / 3) % 1 + 1) % 1;
        return cu < 0.035 && cv >= 0.89 && cv < 0.935;
      }
    );
    if (frontCasingPart) lightHousingChunks.push(frontCasingPart);

    // 4. Rear Taillights (z <= 1.5, i.e., z < -1.5): bright LED tail clusters (v >= 0.95 or u > 0.2) vs dark rear housing
    const tailLedPart = filterChunkTriangles(
      ch,
      (p0, p1, p2, uv0, uv1, uv2) => {
        const cz = (p0[2] + p1[2] + p2[2]) / 3;
        if (cz > 1.5) return false;
        const cu = (((uv0[0] + uv1[0] + uv2[0]) / 3) % 1 + 1) % 1;
        const cv = (((uv0[1] + uv1[1] + uv2[1]) / 3) % 1 + 1) % 1;
        return cv >= 0.95 || cu > 0.2;
      }
    );
    if (tailLedPart) taillightChunks.push(tailLedPart);

    const rearCasingPart = filterChunkTriangles(
      ch,
      (p0, p1, p2, uv0, uv1, uv2) => {
        const cz = (p0[2] + p1[2] + p2[2]) / 3;
        if (cz > 1.5) return false;
        const cu = (((uv0[0] + uv1[0] + uv2[0]) / 3) % 1 + 1) % 1;
        const cv = (((uv0[1] + uv1[1] + uv2[1]) / 3) % 1 + 1) % 1;
        return !(cv >= 0.95 || cu > 0.2);
      }
    );
    if (rearCasingPart) lightHousingChunks.push(rearCasingPart);
  }

  // Collect car_body nodes:
  // Note: ManufacturerPlate_Geo_lodA is the "Audi Sport" text decal on the license plate — we omit the text decal
  // or make the plate backing plain black so the license plate area is plain/blank as required!
  const BODY_NODE_PATTERNS = [
    { substr: "Paint_Geo_lodA", category: "body_paint", includeInLite: true },
    { substr: "Coloured_Geo_lodA", category: "body_trim", includeInLite: true },
    { substr: "Base_Geo_lodA", category: "body_underbody", includeInLite: true },
    { substr: "Carbon1M_Geo_lodA", category: "body_carbon", includeInLite: true },
    { substr: "Textured_Geo_lodA", category: "body_trim", includeInLite: true },
    { substr: "Textured2_Geo_lodA", category: "body_trim", includeInLite: true },
    { substr: "Badge_Geo_lodA", category: "body_badge", includeInLite: true },
    { substr: "Grille1_Geo_lodA", category: "body_grille", includeInLite: true },
    { substr: "Grille2_Geo_lodA", category: "body_grille", includeInLite: true },
    { substr: "Grille3_Geo_lodA", category: "body_grille", includeInLite: true },
    { substr: "Grille4_Geo_lodA", category: "body_grille", includeInLite: true },
    { substr: "Grille5_Geo_lodA", category: "body_grille", includeInLite: true },
    { substr: "Grille6_Geo_lodA", category: "body_grille", includeInLite: true },
    { substr: "Grille7_Geo_lodA", category: "body_grille", includeInLite: true },
    { substr: "Grille8_Geo_lodA", category: "body_grille", includeInLite: true },
    { substr: "Grille9_Geo_lodA", category: "body_grille", includeInLite: true },
    // Plain license plate backing (will receive plain dark material without any text texture)
    { substr: "ManufacturerPlate_Geo_lodA", category: "body_plate_blank", includeInLite: true },
    // Interior & Engine bay: included in desktop hero-car.glb (with dark interior material), removed in mobile hero-car-lite.glb
    { substr: "Interior_Geo_lodA", category: "interior", includeInLite: false },
    { substr: "InteriorTilling_Geo_lodA", category: "interior", includeInLite: false },
    { substr: "SeatBelt_Geo_lodA", category: "interior", includeInLite: false },
    { substr: "Engine_Geo_lodA", category: "interior", includeInLite: false },
  ];

  const bodyGroupsDesktop = new Map();
  const bodyGroupsLite = new Map();

  for (const spec of BODY_NODE_PATTERNS) {
    const n = findNodeByName(spec.substr);
    if (!n) continue;
    const chs = collectSubtreeChunks(
      n,
      getParentWorldMat(n),
      scaleToMeters,
      normOffset
    );
    if (!bodyGroupsDesktop.has(spec.category)) {
      bodyGroupsDesktop.set(spec.category, []);
    }
    bodyGroupsDesktop.get(spec.category).push(...chs);

    if (spec.includeInLite) {
      if (!bodyGroupsLite.has(spec.category)) {
        bodyGroupsLite.set(spec.category, []);
      }
      bodyGroupsLite.get(spec.category).push(...chs);
    }
  }

  // Also add the dark lamp housings to body_trim
  bodyGroupsDesktop.get("body_trim").push(...lightHousingChunks);
  bodyGroupsLite.get("body_trim").push(...lightHousingChunks);

  // Measure full normalized car bounding box & headlight positions
  const allCarChunks = [
    ...chunksFL,
    ...chunksFR,
    ...chunksRL,
    ...chunksRR,
    ...glassChunks,
    ...headlightChunks,
    ...drlChunks,
    ...taillightChunks,
  ];
  for (const chList of bodyGroupsDesktop.values()) {
    allCarChunks.push(...chList);
  }
  const fullBounds = computeChunksBounds(allCarChunks);

  // Measure left and right headlight lamp centers
  const leftHlTris = [];
  const rightHlTris = [];
  for (const ch of [...headlightChunks, ...drlChunks]) {
    const L = filterChunkTriangles(
      ch,
      (p0, p1, p2) => (p0[0] + p1[0] + p2[0]) / 3 > 0
    );
    const R = filterChunkTriangles(
      ch,
      (p0, p1, p2) => (p0[0] + p1[0] + p2[0]) / 3 < 0
    );
    if (L) leftHlTris.push(L);
    if (R) rightHlTris.push(R);
  }
  const hlLeftBounds = computeChunksBounds(leftHlTris);
  const hlRightBounds = computeChunksBounds(rightHlTris);

  const tlBounds = computeChunksBounds(taillightChunks);

  const wheelRadius = Number(
    (
      (bFL.size[1] + bFR.size[1] + bRL.size[1] + bRR.size[1]) /
      8
    ).toFixed(4)
  );
  const wheelbase = Number(
    (
      (bFL.center[2] + bFR.center[2]) / 2 -
      (bRL.center[2] + bRR.center[2]) / 2
    ).toFixed(4)
  );
  const trackWidth = Number(
    (
      (Math.abs(bFL.center[0] - bFR.center[0]) +
        Math.abs(bRL.center[0] - bRR.center[0])) /
      2
    ).toFixed(4)
  );
  const comHeight = Number((fullBounds.size[1] * 0.38).toFixed(4));

  const roundVec3 = (v) => v.map((x) => Number(x.toFixed(4)));

  const carMeta = {
    modelName: "2020 Audi RS7 Sportback (C8)",
    author: "Ddiaz Design",
    sourceUrl:
      "https://sketchfab.com/3d-models/2020-audi-rs7-sportback-61dd9575a8c645558aa912042af0cfc1",
    license: "CC-BY-NC-SA-4.0",
    units: "meters",
    forwardAxis: "+Z",
    upAxis: "+Y",
    wheelRadius,
    wheelbase,
    trackWidth,
    centerOfMassHeight: comHeight,
    wheelCenters: {
      FL: roundVec3(bFL.center),
      FR: roundVec3(bFR.center),
      RL: roundVec3(bRL.center),
      RR: roundVec3(bRR.center),
    },
    boundingBox: {
      min: roundVec3(fullBounds.min),
      max: roundVec3(fullBounds.max),
      size: roundVec3(fullBounds.size),
      center: roundVec3(fullBounds.center),
    },
    headlightLamps: {
      left: roundVec3(hlLeftBounds.center),
      right: roundVec3(hlRightBounds.center),
    },
    taillightLamps: {
      left: [
        Number(Math.abs(tlBounds.max[0] * 0.72).toFixed(4)),
        Number(tlBounds.center[1].toFixed(4)),
        Number(tlBounds.min[2].toFixed(4)),
      ],
      right: [
        Number((-Math.abs(tlBounds.max[0] * 0.72)).toFixed(4)),
        Number(tlBounds.center[1].toFixed(4)),
        Number(tlBounds.min[2].toFixed(4)),
      ],
    },
    nodeNames: [
      "car_body",
      "steer_FL",
      "steer_FR",
      "wheel_FL",
      "wheel_FR",
      "wheel_RL",
      "wheel_RR",
      "calipers",
      "glass",
      "headlights",
      "drl",
      "taillights",
    ],
  };

  /**
   * Builds a clean, normalized glTF Document with the exact required node tree and materials.
   */
  async function buildCarDocument({ isLite }) {
    const doc = new Document();
    const buf = doc.createBuffer();
    const scene = doc.createScene("HeroCarScene");

    // Create semantic PBR materials (runtime loader will also apply exact MeshPhysicalMaterial overrides)
    const matPaint = doc
      .createMaterial("mat_car_paint")
      .setBaseColorFactor([0.02, 0.024, 0.031, 1.0])
      .setMetallicFactor(0.55)
      .setRoughnessFactor(0.3);

    const matTrim = doc
      .createMaterial("mat_car_trim")
      .setBaseColorFactor([0.035, 0.04, 0.05, 1.0])
      .setMetallicFactor(0.5)
      .setRoughnessFactor(0.45);

    const matGrille = doc
      .createMaterial("mat_car_grille")
      .setBaseColorFactor([0.025, 0.028, 0.035, 1.0])
      .setMetallicFactor(0.65)
      .setRoughnessFactor(0.42);

    const matCarbon = doc
      .createMaterial("mat_car_carbon")
      .setBaseColorFactor([0.04, 0.045, 0.055, 1.0])
      .setMetallicFactor(0.4)
      .setRoughnessFactor(0.35);

    const matUnderbody = doc
      .createMaterial("mat_car_underbody")
      .setBaseColorFactor([0.02, 0.02, 0.025, 1.0])
      .setMetallicFactor(0.1)
      .setRoughnessFactor(0.8);

    const matPlateBlank = doc
      .createMaterial("mat_license_plate_blank")
      .setBaseColorFactor([0.03, 0.035, 0.045, 1.0])
      .setMetallicFactor(0.2)
      .setRoughnessFactor(0.5);

    // Preserve badge texture from original GLB so Audi rings & RS7 badge remain crisp
    const matBadge = doc
      .createMaterial("mat_car_badge")
      .setBaseColorFactor([0.85, 0.88, 0.92, 1.0])
      .setMetallicFactor(0.85)
      .setRoughnessFactor(0.25);

    const matInterior = doc
      .createMaterial("mat_car_interior")
      .setBaseColorFactor([0.02, 0.024, 0.03, 1.0])
      .setMetallicFactor(0.08)
      .setRoughnessFactor(0.88);

    const matTire = doc
      .createMaterial("mat_wheel_tire")
      .setBaseColorFactor([0.039, 0.039, 0.043, 1.0])
      .setMetallicFactor(0.08)
      .setRoughnessFactor(0.75);

    const matRim = doc
      .createMaterial("mat_wheel_rim")
      .setBaseColorFactor([0.12, 0.135, 0.16, 1.0])
      .setMetallicFactor(0.82)
      .setRoughnessFactor(0.35);

    const matCaliper = doc
      .createMaterial("mat_caliper_red")
      .setBaseColorFactor([0.784, 0.063, 0.18, 1.0])
      .setMetallicFactor(0.25)
      .setRoughnessFactor(0.4);

    const matGlass = doc
      .createMaterial("mat_glass")
      .setBaseColorFactor([0.02, 0.028, 0.04, 0.35])
      .setMetallicFactor(0.1)
      .setRoughnessFactor(0.05)
      .setAlphaMode("BLEND");

    const matHeadlights = doc
      .createMaterial("mat_headlights")
      .setBaseColorFactor([0.75, 0.84, 1.0, 1.0])
      .setEmissiveFactor([0.184, 0.42, 1.0])
      .setMetallicFactor(0.1)
      .setRoughnessFactor(0.1);

    const matDrl = doc
      .createMaterial("mat_drl")
      .setBaseColorFactor([0.85, 0.92, 1.0, 1.0])
      .setEmissiveFactor([0.75, 0.84, 1.0])
      .setMetallicFactor(0.05)
      .setRoughnessFactor(0.08);

    const matTaillights = doc
      .createMaterial("mat_taillights")
      .setBaseColorFactor([1.0, 0.1, 0.2, 1.0])
      .setEmissiveFactor([0.784, 0.063, 0.18])
      .setMetallicFactor(0.1)
      .setRoughnessFactor(0.15);

    // Keep texture as WebP via EXT_texture_webp (or PNG) and check what happened in Playwright console
    const srcBadgeMat = srcRoot
      .listMaterials()
      .find((m) => (m.getName() || "").includes("BadgeA"));
    if (srcBadgeMat && srcBadgeMat.getBaseColorTexture()) {
      const rawImg = srcBadgeMat.getBaseColorTexture().getImage();
      if (rawImg) {
        const pngBuf = await sharp(Buffer.from(rawImg))
          .resize({ width: isLite ? 256 : 512, withoutEnlargement: true })
          .png({ compressionLevel: 9 })
          .toBuffer();
        const badgeTex = doc
          .createTexture("tex_badge")
          .setMimeType("image/png")
          .setImage(new Uint8Array(pngBuf));
        matBadge.setBaseColorTexture(badgeTex);
        matBadge.setAlphaMode("BLEND");
      }
    }

    const categoryToMat = {
      body_paint: matPaint,
      body_trim: matTrim,
      body_grille: matGrille,
      body_carbon: matCarbon,
      body_underbody: matUnderbody,
      body_plate_blank: matPlateBlank,
      body_badge: matBadge,
      interior: matInterior,
    };

    // 1. car_body node
    const bodyGroups = isLite ? bodyGroupsLite : bodyGroupsDesktop;
    const bodyMesh = doc.createMesh("car_body_mesh");
    for (const [cat, chList] of bodyGroups.entries()) {
      const prim = buildMergedPrimitive(
        doc,
        buf,
        chList,
        categoryToMat[cat] || matTrim
      );
      if (prim) bodyMesh.addPrimitive(prim);
    }
    const nodeCarBody = doc.createNode("car_body").setMesh(bodyMesh);
    scene.addChild(nodeCarBody);

    // 2. Helper to build a wheel node centered at its own wheel center pivot
    function createWheelNode(name, splitData, center) {
      const wMesh = doc.createMesh(`${name}_mesh`);
      const tirePrim = buildMergedPrimitive(
        doc,
        buf,
        splitData.tireChunks,
        matTire,
        center
      );
      const rimPrim = buildMergedPrimitive(
        doc,
        buf,
        splitData.rimChunks,
        matRim,
        center
      );
      if (tirePrim) wMesh.addPrimitive(tirePrim);
      if (rimPrim) wMesh.addPrimitive(rimPrim);
      return doc.createNode(name).setMesh(wMesh);
    }

    // Front wheels sit inside steer_FL / steer_FR parent pivots at the exact front wheel centers
    const nodeSteerFL = doc
      .createNode("steer_FL")
      .setTranslation(bFL.center);
    const nodeOutWheelFL = createWheelNode("wheel_FL", splitFL, bFL.center);
    // wheel_FL is a child of steer_FL so its local translation is (0, 0, 0)
    nodeOutWheelFL.setTranslation([0, 0, 0]);
    nodeSteerFL.addChild(nodeOutWheelFL);
    scene.addChild(nodeSteerFL);

    const nodeSteerFR = doc
      .createNode("steer_FR")
      .setTranslation(bFR.center);
    const nodeOutWheelFR = createWheelNode("wheel_FR", splitFR, bFR.center);
    nodeOutWheelFR.setTranslation([0, 0, 0]);
    nodeSteerFR.addChild(nodeOutWheelFR);
    scene.addChild(nodeSteerFR);

    // Rear wheels have their pivot directly at the rear wheel centers
    const nodeOutWheelRL = createWheelNode("wheel_RL", splitRL, bRL.center);
    nodeOutWheelRL.setTranslation(bRL.center);
    scene.addChild(nodeOutWheelRL);

    const nodeOutWheelRR = createWheelNode("wheel_RR", splitRR, bRR.center);
    nodeOutWheelRR.setTranslation(bRR.center);
    scene.addChild(nodeOutWheelRR);

    // 3. calipers node (all 4 brake calipers)
    const allCaliperChunks = [
      ...calChunksFL,
      ...calChunksFR,
      ...calChunksRL,
      ...calChunksRR,
    ];
    const caliperMesh = doc.createMesh("calipers_mesh");
    const caliperPrim = buildMergedPrimitive(
      doc,
      buf,
      allCaliperChunks,
      matCaliper
    );
    if (caliperPrim) caliperMesh.addPrimitive(caliperPrim);
    const nodeCalipers = doc.createNode("calipers").setMesh(caliperMesh);
    scene.addChild(nodeCalipers);

    // 4. glass node
    const glassMesh = doc.createMesh("glass_mesh");
    const glassPrim = buildMergedPrimitive(doc, buf, glassChunks, matGlass);
    if (glassPrim) glassMesh.addPrimitive(glassPrim);
    const nodeGlass = doc.createNode("glass").setMesh(glassMesh);
    scene.addChild(nodeGlass);

    // 5. headlights node
    const hlMesh = doc.createMesh("headlights_mesh");
    const hlPrim = buildMergedPrimitive(
      doc,
      buf,
      headlightChunks,
      matHeadlights
    );
    if (hlPrim) hlMesh.addPrimitive(hlPrim);
    const nodeHeadlights = doc.createNode("headlights").setMesh(hlMesh);
    scene.addChild(nodeHeadlights);

    // 6. drl node
    const drlMesh = doc.createMesh("drl_mesh");
    const drlPrim = buildMergedPrimitive(doc, buf, drlChunks, matDrl);
    if (drlPrim) drlMesh.addPrimitive(drlPrim);
    const nodeDrl = doc.createNode("drl").setMesh(drlMesh);
    scene.addChild(nodeDrl);

    // 7. taillights node
    const tlMesh = doc.createMesh("taillights_mesh");
    const tlPrim = buildMergedPrimitive(
      doc,
      buf,
      taillightChunks,
      matTaillights
    );
    if (tlPrim) tlMesh.addPrimitive(tlPrim);
    const nodeTaillights = doc.createNode("taillights").setMesh(tlMesh);
    scene.addChild(nodeTaillights);

    // Run gltf-transform optimization pipeline: dedup, prune, weld, resample, (simplify on lite), textureCompress(webp), draco
    const transforms = [
      dedup(),
      weld(),
      resample(),
    ];

    if (isLite) {
      // Simplify mobile model (interior already removed -> 145,688 tris) to ~50% of original total (~108k tris <= 120k budget) with locked borders so exterior panels stay crisp
      transforms.push(
        simplify({
          simplifier: MeshoptSimplifier,
          ratio: 0.72,
          error: 0.0005,
          lockBorder: true,
        })
      );
    }

    transforms.push(
      textureCompress({
        encoder: sharp,
        targetFormat: "webp",
        resize: isLite ? [1024, 1024] : [2048, 2048],
      }),
      prune(),
      draco({
        method: "edgebreaker",
        quantizePosition: 14,
        quantizeNormal: 10,
        quantizeTexcoord: 12,
      })
    );

    await doc.transform(...transforms);
    return doc;
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log(`[prepare-car] Building desktop /public/models/hero-car.glb...`);
  const desktopDoc = await buildCarDocument({ isLite: false });
  await io.write(OUT_DESKTOP_GLB, desktopDoc);

  console.log(`[prepare-car] Building mobile /public/models/hero-car-lite.glb...`);
  const liteDoc = await buildCarDocument({ isLite: true });
  await io.write(OUT_MOBILE_GLB, liteDoc);

  await copyDracoDecoderFiles();

  // Count triangles and file sizes of generated outputs
  function countDocTriangles(doc) {
    let tris = 0;
    for (const m of doc.getRoot().listMeshes()) {
      for (const p of m.listPrimitives()) {
        const idx = p.getIndices();
        const pos = p.getAttribute("POSITION");
        if (idx) tris += idx.getCount() / 3;
        else if (pos) tris += pos.getCount() / 3;
      }
    }
    return Math.round(tris);
  }

  const desktopSizeMB = Number(
    (fs.statSync(OUT_DESKTOP_GLB).size / (1024 * 1024)).toFixed(3)
  );
  const liteSizeMB = Number(
    (fs.statSync(OUT_MOBILE_GLB).size / (1024 * 1024)).toFixed(3)
  );
  const desktopTris = countDocTriangles(desktopDoc);
  const liteTris = countDocTriangles(liteDoc);

  carMeta.outputs = {
    desktop: {
      path: "/models/hero-car.glb",
      sizeMB: desktopSizeMB,
      triangles: desktopTris,
    },
    mobile: {
      path: "/models/hero-car-lite.glb",
      sizeMB: liteSizeMB,
      triangles: liteTris,
    },
  };

  fs.writeFileSync(OUT_META_JSON, JSON.stringify(carMeta, null, 2) + "\n");
  console.log(`[prepare-car] Wrote ${OUT_META_JSON}:`);
  console.log(JSON.stringify(carMeta, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
