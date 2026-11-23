import * as THREE from "three";
import { HERO3D_CONFIG, type Hero3DConfig } from "@/lib/hero3d-config";

export interface RiggedCarNodes {
  root: THREE.Group;
  car_body: THREE.Object3D | null;
  steer_FL: THREE.Object3D | null;
  steer_FR: THREE.Object3D | null;
  wheel_FL: THREE.Object3D | null;
  wheel_FR: THREE.Object3D | null;
  wheel_RL: THREE.Object3D | null;
  wheel_RR: THREE.Object3D | null;
  calipers: THREE.Object3D | null;
  glass: THREE.Object3D | null;
  headlights: THREE.Object3D | null;
  drl: THREE.Object3D | null;
  taillights: THREE.Object3D | null;
  materials: THREE.Material[];
}

/**
 * Applies the exact PBR materials from /lib/hero3d-config.ts to a loaded Audi GLB scene
 * and resolves all required named rig nodes:
 * - Black paint: MeshPhysicalMaterial color #050608, metalness 0.55, roughness 0.30,
 *   clearcoat 1, clearcoatRoughness 0.04, envMapIntensity 1.3
 * - Tires: roughness 0.75, color #0a0a0b
 * - Rims: dark metal, roughness 0.35
 * - Calipers: red #C8102E, roughness 0.4
 * - Glass: no transmission, dark tint, opacity 0.35, roughness 0.05, envMapIntensity 1.5, depthWrite false
 * - Headlights & DRL: emissive in the neon color, emissiveIntensity from config
 * - Taillights: red emissive
 * - Interior: simple and very dark (barely visible)
 */
export function applyCarMaterialsAndRig(
  root: THREE.Group,
  config: Hero3DConfig = HERO3D_CONFIG
): RiggedCarNodes {
  const mCfg = config.materials;
  const createdMaterials: THREE.Material[] = [];

  const matPaint = new THREE.MeshPhysicalMaterial({
    name: "runtime_car_paint",
    color: new THREE.Color(mCfg.paint.color),
    metalness: mCfg.paint.metalness,
    roughness: mCfg.paint.roughness,
    clearcoat: mCfg.paint.clearcoat,
    clearcoatRoughness: mCfg.paint.clearcoatRoughness,
    envMapIntensity: mCfg.paint.envMapIntensity,
  });

  const matTire = new THREE.MeshStandardMaterial({
    name: "runtime_wheel_tire",
    color: new THREE.Color(mCfg.tires.color),
    metalness: mCfg.tires.metalness,
    roughness: mCfg.tires.roughness,
  });

  const matRim = new THREE.MeshStandardMaterial({
    name: "runtime_wheel_rim",
    color: new THREE.Color(mCfg.rims.color),
    metalness: mCfg.rims.metalness,
    roughness: mCfg.rims.roughness,
    envMapIntensity: mCfg.rims.envMapIntensity,
  });

  const matCaliper = new THREE.MeshPhysicalMaterial({
    name: "runtime_caliper_red",
    color: new THREE.Color(mCfg.calipers.color),
    metalness: mCfg.calipers.metalness,
    roughness: mCfg.calipers.roughness,
    clearcoat: mCfg.calipers.clearcoat,
  });

  const matGlass = new THREE.MeshPhysicalMaterial({
    name: "runtime_glass",
    color: new THREE.Color(mCfg.glass.color),
    transparent: true,
    opacity: mCfg.glass.opacity,
    roughness: mCfg.glass.roughness,
    metalness: mCfg.glass.metalness,
    envMapIntensity: mCfg.glass.envMapIntensity,
    depthWrite: mCfg.glass.depthWrite,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
  });

  const matHeadlights = new THREE.MeshStandardMaterial({
    name: "runtime_headlights",
    color: new THREE.Color(mCfg.headlights.color),
    emissive: new THREE.Color(mCfg.headlights.emissive),
    emissiveIntensity: mCfg.headlights.emissiveIntensity,
    roughness: mCfg.headlights.roughness,
    metalness: 0.1,
  });

  const matDrl = new THREE.MeshStandardMaterial({
    name: "runtime_drl",
    color: new THREE.Color(mCfg.drl.color),
    emissive: new THREE.Color(mCfg.drl.emissive),
    emissiveIntensity: mCfg.drl.emissiveIntensity,
    roughness: mCfg.drl.roughness,
    metalness: 0.05,
  });

  const matTaillights = new THREE.MeshStandardMaterial({
    name: "runtime_taillights",
    color: new THREE.Color(mCfg.taillights.color),
    emissive: new THREE.Color(mCfg.taillights.emissive),
    emissiveIntensity: mCfg.taillights.emissiveIntensity,
    roughness: mCfg.taillights.roughness,
    metalness: 0.1,
  });

  const matInterior = new THREE.MeshStandardMaterial({
    name: "runtime_interior",
    color: new THREE.Color(mCfg.interior.color),
    roughness: mCfg.interior.roughness,
    metalness: mCfg.interior.metalness,
  });

  const matTrimDark = new THREE.MeshStandardMaterial({
    name: "runtime_trim_dark",
    color: new THREE.Color(mCfg.trimDark.color),
    roughness: mCfg.trimDark.roughness,
    metalness: mCfg.trimDark.metalness,
  });

  const matGrille = new THREE.MeshStandardMaterial({
    name: "runtime_grille",
    color: new THREE.Color("#07090d"),
    roughness: 0.38,
    metalness: 0.65,
  });

  const matCarbon = new THREE.MeshPhysicalMaterial({
    name: "runtime_carbon",
    color: new THREE.Color("#0b0d12"),
    roughness: 0.32,
    metalness: 0.4,
    clearcoat: 0.7,
    clearcoatRoughness: 0.12,
  });

  createdMaterials.push(
    matPaint,
    matTire,
    matRim,
    matCaliper,
    matGlass,
    matHeadlights,
    matDrl,
    matTaillights,
    matInterior,
    matTrimDark,
    matGrille,
    matCarbon
  );

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;

    const nodeName = mesh.name || mesh.parent?.name || "";
    const oldMat = Array.isArray(mesh.material)
      ? mesh.material[0]
      : mesh.material;
    const matName = oldMat?.name || "";

    if (nodeName === "glass" || matName === "mat_glass") {
      mesh.material = matGlass;
      mesh.renderOrder = 3;
      return;
    }
    if (nodeName === "headlights" || matName === "mat_headlights") {
      mesh.material = matHeadlights;
      return;
    }
    if (nodeName === "drl" || matName === "mat_drl") {
      mesh.material = matDrl;
      return;
    }
    if (nodeName === "taillights" || matName === "mat_taillights") {
      mesh.material = matTaillights;
      return;
    }
    if (nodeName === "calipers" || matName === "mat_caliper_red") {
      mesh.material = matCaliper;
      return;
    }
    if (matName === "mat_wheel_tire") {
      mesh.material = matTire;
      return;
    }
    if (matName === "mat_wheel_rim") {
      mesh.material = matRim;
      return;
    }
    if (matName === "mat_car_paint") {
      mesh.material = matPaint;
      return;
    }
    if (matName === "mat_car_interior") {
      mesh.material = matInterior;
      return;
    }
    if (matName === "mat_car_grille") {
      mesh.material = matGrille;
      return;
    }
    if (matName === "mat_car_carbon") {
      mesh.material = matCarbon;
      return;
    }
    if (
      matName === "mat_car_trim" ||
      matName === "mat_car_underbody" ||
      matName === "mat_license_plate_blank"
    ) {
      mesh.material = matTrimDark;
      return;
    }
    // Keep mat_car_badge with its embedded WebP texture, but boost metallic chrome response
    if (matName === "mat_car_badge" && oldMat) {
      const std = oldMat as THREE.MeshStandardMaterial;
      std.metalness = 0.85;
      std.roughness = 0.22;
      std.envMapIntensity = 1.4;
      std.needsUpdate = true;
    }
  });

  return {
    root,
    car_body: root.getObjectByName("car_body") ?? null,
    steer_FL: root.getObjectByName("steer_FL") ?? null,
    steer_FR: root.getObjectByName("steer_FR") ?? null,
    wheel_FL: root.getObjectByName("wheel_FL") ?? null,
    wheel_FR: root.getObjectByName("wheel_FR") ?? null,
    wheel_RL: root.getObjectByName("wheel_RL") ?? null,
    wheel_RR: root.getObjectByName("wheel_RR") ?? null,
    calipers: root.getObjectByName("calipers") ?? null,
    glass: root.getObjectByName("glass") ?? null,
    headlights: root.getObjectByName("headlights") ?? null,
    drl: root.getObjectByName("drl") ?? null,
    taillights: root.getObjectByName("taillights") ?? null,
    materials: createdMaterials,
  };
}
