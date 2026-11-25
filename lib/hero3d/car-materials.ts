import * as THREE from "three";
import carMeta from "@/lib/car-meta.generated.json";
import { HERO3D_CONFIG, type Hero3DConfig } from "@/lib/hero3d-config";

export interface RiggedCarNodes {
  root: THREE.Group;
  /** Group holding all sprung chassis parts (car_body, glass, headlights, drl, taillights) pivoted at axle height */
  sprungBodyGroup: THREE.Group;
  sprungPivotY: number;
  steer_FL: THREE.Object3D | null;
  steer_FR: THREE.Object3D | null;
  wheel_FL: THREE.Object3D | null;
  wheel_FR: THREE.Object3D | null;
  wheel_RL: THREE.Object3D | null;
  wheel_RR: THREE.Object3D | null;
  materials: THREE.Material[];
}

/**
 * Applies smooth showroom PBR materials from `/lib/hero3d-config.ts` to the normalized Audi GLB:
 * - Relies on `scene.environment` (`RoomEnvironment` PMREM, `environmentIntensity = 0.9`) with no
 *   per-material `envMap` overrides and `envMapIntensity: 0.9` on the car materials.
 * - Groups sprung body parts (`car_body`, `glass`, `headlights`, `drl`, `taillights`) around axle
 *   height (`y = wheelRadius`) so braking pitch and cornering roll move only the body while all
 *   4 wheels stay grounded on `y = 0`.
 */
export function applyCarMaterialsAndRig(
  root: THREE.Group,
  config: Hero3DConfig = HERO3D_CONFIG
): RiggedCarNodes {
  const mCfg = config.materials;
  const createdMaterials: THREE.Material[] = [];

  const matPaint = new THREE.MeshPhysicalMaterial({
    name: "runtime_car_paint",
    color: new THREE.Color(config.paintColor),
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
    depthWrite: false,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
  });

  const drlOn = config.drl === "static";

  const matHeadlights = new THREE.MeshStandardMaterial({
    name: "runtime_headlights",
    color: new THREE.Color(mCfg.headlights.color),
    emissive: new THREE.Color(mCfg.headlights.emissive),
    emissiveIntensity: drlOn ? mCfg.headlights.emissiveIntensity : 0,
    roughness: mCfg.headlights.roughness,
    metalness: 0.1,
  });

  const matDrl = new THREE.MeshStandardMaterial({
    name: "runtime_drl",
    color: new THREE.Color(mCfg.drlLamp.color),
    emissive: new THREE.Color(mCfg.drlLamp.emissive),
    emissiveIntensity: drlOn ? mCfg.drlLamp.emissiveIntensity : 0,
    roughness: mCfg.drlLamp.roughness,
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
    color: new THREE.Color("#0E1219"),
    roughness: 0.36,
    metalness: 0.68,
  });

  const matCarbon = new THREE.MeshPhysicalMaterial({
    name: "runtime_carbon",
    color: new THREE.Color("#131820"),
    roughness: 0.3,
    metalness: 0.42,
    clearcoat: 0.75,
    clearcoatRoughness: 0.1,
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
    if (matName === "mat_car_badge" && oldMat) {
      const std = oldMat as THREE.MeshStandardMaterial;
      std.metalness = 0.88;
      std.roughness = 0.2;
      std.envMapIntensity = 0.9;
      std.needsUpdate = true;
    }
  });

  const car_body = root.getObjectByName("car_body") ?? null;
  const steer_FL = root.getObjectByName("steer_FL") ?? null;
  const steer_FR = root.getObjectByName("steer_FR") ?? null;
  const wheel_FL = root.getObjectByName("wheel_FL") ?? null;
  const wheel_FR = root.getObjectByName("wheel_FR") ?? null;
  const wheel_RL = root.getObjectByName("wheel_RL") ?? null;
  const wheel_RR = root.getObjectByName("wheel_RR") ?? null;
  const glass = root.getObjectByName("glass") ?? null;
  const headlights = root.getObjectByName("headlights") ?? null;
  const drl = root.getObjectByName("drl") ?? null;
  const taillights = root.getObjectByName("taillights") ?? null;

  const sprungPivotY = carMeta.wheelRadius;
  const sprungBodyGroup = new THREE.Group();
  sprungBodyGroup.name = "sprung_body_group";
  sprungBodyGroup.position.set(0, sprungPivotY, 0);
  root.add(sprungBodyGroup);

  for (const node of [car_body, glass, headlights, drl, taillights]) {
    if (node) {
      node.position.y -= sprungPivotY;
      sprungBodyGroup.add(node);
    }
  }

  return {
    root,
    sprungBodyGroup,
    sprungPivotY,
    steer_FL,
    steer_FR,
    wheel_FL,
    wheel_FR,
    wheel_RL,
    wheel_RR,
    materials: createdMaterials,
  };
}
