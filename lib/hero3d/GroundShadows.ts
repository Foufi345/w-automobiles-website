import * as THREE from "three";
import carMeta from "@/lib/car-meta.generated.json";
import { HERO3D_CONFIG, type Hero3DConfig } from "@/lib/hero3d-config";

/**
 * Generates a 256x256 `CanvasTexture` containing a black 2D radial gradient with exact `0`
 * alpha along a 2 px outer safety margin so no square/rectangle edge is ever visible.
 */
function createRadialShadowCanvasTexture(
  stops: ReadonlyArray< readonly [number, number] >
): THREE.CanvasTexture {
  const size = 256;
  const half = size / 2;
  const maxRadius = half - 2; // 2 px guaranteed transparent border around all 4 edges

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    ctx.clearRect(0, 0, size, size);
    const grad = ctx.createRadialGradient(half, half, 0, half, half, maxRadius);
    for (const [offset, alpha] of stops) {
      const clampedOffset = Math.max(0, Math.min(1, offset));
      const clampedAlpha = Math.max(0, Math.min(1, alpha));
      grad.addColorStop(clampedOffset, `rgba(0, 0, 0, ${clampedAlpha})`);
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Soft Procedural Contact & Ambient Ground Shadows:
 * - Attached directly to the car's HEADING group (`carPivotGroup`), so they follow
 *   position `(x, 0, z)` and heading `headingRad`, NOT the body pitch/roll spring group.
 * - Uses `PlaneGeometry(1, 1)` rotated `-90 deg` about X, `MeshBasicMaterial` with
 *   `CanvasTexture`, `transparent: true`, `depthWrite: false`, `toneMapped: false`, `fog: false`.
 * - Sized directly from `/lib/car-meta.generated.json` (`L`, `Wd`, `wheelCenters`, `tireWidth`):
 *   a. 4 Tire patches at `y = 0.006`, `(tireWidth * 1.5, 0.45 m)`, peak alpha `0.9`
 *   b. Contact shadow at `y = 0.004`, `(Wd * 0.98, L * 0.88)`, peak alpha `0.8`
 *   c. Ambient shadow at `y = 0.003`, `(Wd * 1.6, L * 1.3)`, peak alpha `0.42`
 */
export class GroundShadows {
  private readonly parentGroup: THREE.Group;
  private readonly group: THREE.Group;
  private sharedGeo: THREE.PlaneGeometry | null = null;
  private readonly textures: THREE.CanvasTexture[] = [];
  private readonly materials: THREE.MeshBasicMaterial[] = [];

  constructor(
    headingGroup: THREE.Group,
    config: Hero3DConfig = HERO3D_CONFIG
  ) {
    this.parentGroup = headingGroup;
    this.group = new THREE.Group();
    this.group.name = "car_ground_shadows_group";

    const sCfg = config.groundShadow;
    const strength = Math.max(0, Math.min(1, sCfg.strength));
    if (strength <= 0) {
      this.group.visible = false;
      this.parentGroup.add(this.group);
      return;
    }

    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    this.sharedGeo = geo;

    const Wd = carMeta.boundingBox.size[0];
    const L = carMeta.boundingBox.size[2];
    const centerX = carMeta.boundingBox.center[0];
    const centerZ = carMeta.boundingBox.center[2];
    const tireWidth = carMeta.tireWidth;

    const makeShadowMaterial = (
      name: string,
      stops: Array<[number, number]>,
      peakAlpha: number
    ): THREE.MeshBasicMaterial => {
      const tex = createRadialShadowCanvasTexture(stops);
      this.textures.push(tex);
      const mat = new THREE.MeshBasicMaterial({
        name,
        map: tex,
        transparent: true,
        opacity: Math.max(0, Math.min(1, peakAlpha * strength)),
        depthWrite: false,
        toneMapped: false,
        fog: false,
      });
      this.materials.push(mat);
      return mat;
    };

    // c. Ambient shadow: y = 0.003, size (Wd * 1.6, L * 1.3)
    const ambientMat = makeShadowMaterial(
      "shadow_ambient_mat",
      sCfg.ambient.stops,
      sCfg.ambient.peakAlpha
    );
    const ambientMesh = new THREE.Mesh(geo, ambientMat);
    ambientMesh.name = "shadow_ambient";
    ambientMesh.position.set(centerX, sCfg.ambient.y, centerZ);
    ambientMesh.scale.set(
      Wd * sCfg.ambient.widthMultiplier,
      1,
      L * sCfg.ambient.lengthMultiplier
    );
    ambientMesh.renderOrder = -3;
    this.group.add(ambientMesh);

    // b. Contact shadow: y = 0.004, size (Wd * 0.98, L * 0.88)
    const contactMat = makeShadowMaterial(
      "shadow_contact_mat",
      sCfg.contact.stops,
      sCfg.contact.peakAlpha
    );
    const contactMesh = new THREE.Mesh(geo, contactMat);
    contactMesh.name = "shadow_contact";
    contactMesh.position.set(centerX, sCfg.contact.y, centerZ);
    contactMesh.scale.set(
      Wd * sCfg.contact.widthMultiplier,
      1,
      L * sCfg.contact.lengthMultiplier
    );
    contactMesh.renderOrder = -2;
    this.group.add(contactMesh);

    // a. Tire patches (4): at each wheel center, y = 0.006, size (tireWidth * 1.5, 0.45 m)
    const tireMat = makeShadowMaterial(
      "shadow_tire_patch_mat",
      sCfg.tirePatches.stops,
      sCfg.tirePatches.peakAlpha
    );
    const patchW = tireWidth * sCfg.tirePatches.widthMultiplier;
    const patchL = sCfg.tirePatches.lengthM;
    const wheelKeys = ["FL", "FR", "RL", "RR"] as const;

    for (const key of wheelKeys) {
      const wc = carMeta.wheelCenters[key];
      const patchMesh = new THREE.Mesh(geo, tireMat);
      patchMesh.name = `shadow_tire_${key}`;
      patchMesh.position.set(wc[0], sCfg.tirePatches.y, wc[2]);
      patchMesh.scale.set(patchW, 1, patchL);
      patchMesh.renderOrder = -1;
      this.group.add(patchMesh);
    }

    this.parentGroup.add(this.group);
  }

  public dispose(): void {
    this.parentGroup.remove(this.group);
    this.group.clear();

    if (this.sharedGeo) {
      this.sharedGeo.dispose();
      this.sharedGeo = null;
    }
    for (const mat of this.materials) {
      mat.dispose();
    }
    this.materials.length = 0;

    for (const tex of this.textures) {
      tex.dispose();
    }
    this.textures.length = 0;
  }
}
