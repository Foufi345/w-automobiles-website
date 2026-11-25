import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import carMeta from "@/lib/car-meta.generated.json";
import { HERO3D_CONFIG, type Hero3DConfig } from "@/lib/hero3d-config";
import {
  applyCarMaterialsAndRig,
  type RiggedCarNodes,
} from "@/lib/hero3d/car-materials";
import {
  ArrivalKinematicsSolver,
  type ArrivalFrameSample,
} from "@/lib/hero3d/ArrivalKinematics";
import { GroundShadows } from "@/lib/hero3d/GroundShadows";
import {
  notifyHeroArrivalCompleted,
  notifyHeroArrivalStarted,
} from "@/lib/hero3d/session-state";

export interface FramingZoneRects {
  viewportWidth: number;
  viewportHeight: number;
  /** Bottom Y of header + badge + H1 in CSS px relative to hero top */
  topReservedBottomPx: number;
  /** Top Y of subtitle + CTAs in CSS px relative to hero top */
  bottomReservedTopPx: number;
}

export interface FramingTelemetry {
  viewportWidth: number;
  viewportHeight: number;
  topReservedBottomPx: number;
  bottomReservedTopPx: number;
  bandTopPx: number;
  bandBottomPx: number;
  cameraDistanceScale: number;
  cameraPosition: [number, number, number];
  verticalFovDeg: number;
  horizontalFovDeg: number;
  viewOffsetXPx: number;
  viewOffsetYPx: number;
  parkedBoxPx: {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
    widthRatio: number;
  };
  minArrivalTopYPx: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
}

/**
 * Plain Three.js Imperative HeroScene:
 * - Transparent canvas (`alpha: true`, `setClearColor(0x000000, 0)`), no `scene.background`, no `fog`.
 * - Pure CSS textured dark-navy background shows cleanly through the canvas.
 * - `RoomEnvironment` via `PMREMGenerator` set on `scene.environment` (`environmentIntensity = 0.9`,
 *   never as background) + key light (`2.2`) + `#9FB8D6` cool rim (`1.4`) + `HemisphereLight` (`0.35`).
 * - Soft radial-gradient `GroundShadows` attached to `carPivotGroup` (position + heading, no pitch/roll).
 * - Stops `requestAnimationFrame` completely after parking; renders again only on resize.
 */
export class HeroScene {
  private container: HTMLElement;
  private config: Hero3DConfig;
  private posterMode: boolean;

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private envRenderTarget: THREE.WebGLRenderTarget;

  private carPivotGroup: THREE.Group;
  private groundShadows: GroundShadows;
  private carRig: RiggedCarNodes | null = null;
  private dracoLoader: DRACOLoader;
  private abortController: AbortController | null = null;
  private isDisposed = false;

  private desktopKinematics: ArrivalKinematicsSolver;
  private mobileKinematics: ArrivalKinematicsSolver;
  private useMobileModel: boolean;

  private currentFraming: FramingZoneRects;
  private lastTelemetry: FramingTelemetry | null = null;

  private currentTimeSec = 0;
  private lastSample: ArrivalFrameSample;
  private rafId: number | null = null;
  private lastFramePerfMs = 0;

  private guardAccumMs = 0;
  private guardFrameCount = 0;
  private guardChecked = false;
  private skipFirstDelta = false;
  private textRevealFired = false;

  private onFallbackToPoster?: (reason: string) => void;
  private onTextRevealChange?: (mode: "hidden" | "reveal" | "instant") => void;

  constructor(
    container: HTMLElement,
    initialFraming: FramingZoneRects,
    options?: {
      config?: Hero3DConfig;
      posterMode?: boolean;
      onFallbackToPoster?: (reason: string) => void;
      onTextRevealChange?: (mode: "hidden" | "reveal" | "instant") => void;
    }
  ) {
    this.container = container;
    this.config = options?.config ?? HERO3D_CONFIG;
    this.posterMode = Boolean(options?.posterMode);
    this.onFallbackToPoster = options?.onFallbackToPoster;
    this.onTextRevealChange = options?.onTextRevealChange;
    this.currentFraming = initialFraming;

    const coarsePointer = Boolean(
      typeof window !== "undefined" &&
        window.matchMedia &&
        window.matchMedia("(pointer: coarse)").matches
    );
    this.useMobileModel =
      !this.posterMode &&
      (coarsePointer ||
        initialFraming.viewportWidth < this.config.framing.mobileBreakpointPx);

    this.desktopKinematics = new ArrivalKinematicsSolver(
      this.config.arrival.desktopDurationSec,
      this.config
    );
    this.mobileKinematics = new ArrivalKinematicsSolver(
      this.config.arrival.mobileDurationSec,
      this.config
    );

    const w = Math.max(1, initialFraming.viewportWidth);
    const h = Math.max(1, initialFraming.viewportHeight);
    const dpr = this.posterMode
      ? 1
      : Math.min(window.devicePixelRatio || 1, this.config.renderer.maxDpr);

    // Transparent canvas over the server-rendered CSS background
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: this.posterMode,
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure =
      this.config.renderer.toneMappingExposure;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = false;

    const canvas = this.renderer.domElement;
    canvas.setAttribute("aria-hidden", "true");
    canvas.setAttribute("data-hero3d-canvas", "ready");
    canvas.style.pointerEvents = "none";
    canvas.className = "pointer-events-none block h-full w-full";
    this.container.innerHTML = "";
    this.container.appendChild(canvas);

    canvas.addEventListener("webglcontextlost", this.handleContextLost, false);
    canvas.addEventListener(
      "webglcontextrestored",
      this.handleContextRestored,
      false
    );

    this.scene = new THREE.Scene();
    this.scene.background = null;
    this.scene.fog = null;

    // RoomEnvironment through PMREMGenerator set on scene.environment ONLY (never as background)
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    pmrem.compileEquirectangularShader();
    const roomEnv = new RoomEnvironment();
    this.envRenderTarget = pmrem.fromScene(roomEnv, 0.04);
    roomEnv.dispose();
    pmrem.dispose();

    this.scene.environment = this.envRenderTarget.texture;
    (
      this.scene as THREE.Scene & { environmentIntensity?: number }
    ).environmentIntensity = this.config.lighting.envMapIntensity;

    // Car studio lights (front-left key 2.2, behind-right #9FB8D6 rim 1.4, hemisphere 0.35; no shadow maps)
    const lCfg = this.config.lighting;
    const keyLight = new THREE.DirectionalLight(
      new THREE.Color(lCfg.keyLight.color),
      lCfg.keyLight.intensity
    );
    keyLight.position.set(...lCfg.keyLight.position);
    keyLight.castShadow = false;
    this.scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(
      new THREE.Color(lCfg.rimLight.color),
      lCfg.rimLight.intensity
    );
    rimLight.position.set(...lCfg.rimLight.position);
    rimLight.castShadow = false;
    this.scene.add(rimLight);

    const hemiLight = new THREE.HemisphereLight(
      new THREE.Color(lCfg.hemiLight.skyColor),
      new THREE.Color(lCfg.hemiLight.groundColor),
      lCfg.hemiLight.intensity
    );
    this.scene.add(hemiLight);

    const camCfg = this.config.camera;
    this.camera = new THREE.PerspectiveCamera(
      camCfg.landscapeVerticalFovDeg,
      w / h,
      camCfg.near,
      camCfg.far
    );
    this.camera.position.set(...camCfg.position);
    this.camera.lookAt(...camCfg.lookAt);

    // Car heading & XZ ground position group
    this.carPivotGroup = new THREE.Group();
    this.carPivotGroup.name = "hero_car_pivot_group";
    this.scene.add(this.carPivotGroup);

    // Soft contact & ambient shadows attached to the car's heading group
    this.groundShadows = new GroundShadows(this.carPivotGroup, this.config);

    const kin = this.getActiveKinematics();
    this.currentTimeSec = kin.durationSec;
    this.lastSample = kin.evaluate(this.currentTimeSec);

    this.computeFraming(initialFraming, false);

    this.dracoLoader = new DRACOLoader();
    this.dracoLoader.setDecoderPath(this.config.loading.dracoDecoderPath);
  }

  private handleContextLost = (event: Event): void => {
    event.preventDefault();
    this.stopRenderLoop();
    this.onFallbackToPoster?.("webglcontextlost");
  };

  private handleContextRestored = (): void => {
    this.stopRenderLoop();
    this.onFallbackToPoster?.("webglcontextrestored");
  };

  public getActiveKinematics(): ArrivalKinematicsSolver {
    return this.useMobileModel ? this.mobileKinematics : this.desktopKinematics;
  }

  public getDurationSec(): number {
    return this.getActiveKinematics().durationSec;
  }

  public async loadCarModel(timeoutMs?: number): Promise<boolean> {
    if (this.isDisposed) return false;

    const glbPath = this.useMobileModel
      ? this.config.loading.mobileGlb
      : this.config.loading.desktopGlb;

    const abortController = new AbortController();
    this.abortController = abortController;
    const budgetMs = timeoutMs ?? this.config.loading.timeoutMs;
    const timer = setTimeout(() => {
      abortController.abort();
    }, budgetMs);

    try {
      const res = await fetch(glbPath, {
        priority: "low",
        signal: abortController.signal,
      } as RequestInit);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const buffer = await res.arrayBuffer();
      if (this.isDisposed) {
        clearTimeout(timer);
        return false;
      }

      const loader = new GLTFLoader();
      loader.setDRACOLoader(this.dracoLoader);

      const blobUrl = URL.createObjectURL(
        new Blob([buffer], { type: "model/gltf-binary" })
      );
      let gltf;
      try {
        gltf = await loader.loadAsync(blobUrl);
      } finally {
        URL.revokeObjectURL(blobUrl);
      }
      clearTimeout(timer);

      if (this.isDisposed) return false;

      this.carRig = applyCarMaterialsAndRig(gltf.scene, this.config);
      this.carPivotGroup.add(this.carRig.root);
      return true;
    } catch {
      clearTimeout(timer);
      if (!this.isDisposed) {
        this.onFallbackToPoster?.("load-timeout-or-error");
      }
      return false;
    }
  }

  /**
   * PURE DETERMINISTIC FUNCTION OF TIME: applyState(tSeconds)
   */
  public applyState(tSeconds: number): ArrivalFrameSample {
    const kin = this.getActiveKinematics();
    const clampedT = Math.max(0, Math.min(kin.durationSec, tSeconds));
    const sample = kin.evaluate(clampedT);
    this.currentTimeSec = clampedT;
    this.lastSample = sample;

    if (this.isDisposed) return sample;

    this.carPivotGroup.position.set(sample.x, 0, sample.z);
    this.carPivotGroup.rotation.set(0, sample.headingRad, 0, "YXZ");

    if (this.carRig) {
      this.carRig.sprungBodyGroup.position.set(
        0,
        this.carRig.sprungPivotY,
        0
      );
      this.carRig.sprungBodyGroup.rotation.set(
        sample.pitchRad,
        0,
        sample.rollRad,
        "YXZ"
      );

      if (this.carRig.steer_FL) {
        this.carRig.steer_FL.rotation.y = sample.steerRad;
      }
      if (this.carRig.steer_FR) {
        this.carRig.steer_FR.rotation.y = sample.steerRad;
      }

      if (this.carRig.wheel_FL) {
        this.carRig.wheel_FL.rotation.x = sample.wheelAngleRad;
      }
      if (this.carRig.wheel_FR) {
        this.carRig.wheel_FR.rotation.x = sample.wheelAngleRad;
      }
      if (this.carRig.wheel_RL) {
        this.carRig.wheel_RL.rotation.x = sample.wheelAngleRad;
      }
      if (this.carRig.wheel_RR) {
        this.carRig.wheel_RR.rotation.x = sample.wheelAngleRad;
      }
    }

    this.carPivotGroup.updateMatrixWorld(true);
    return sample;
  }

  public computeFraming(
    rects: FramingZoneRects,
    renderNow = true
  ): FramingTelemetry {
    this.currentFraming = rects;
    const W = Math.max(1, rects.viewportWidth);
    const H = Math.max(1, rects.viewportHeight);
    const aspect = W / H;

    const dpr = this.posterMode
      ? 1
      : Math.min(window.devicePixelRatio || 1, this.config.renderer.maxDpr);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(W, H, false);

    const camCfg = this.config.camera;
    const fCfg = this.config.framing;

    let vFovRad = THREE.MathUtils.degToRad(camCfg.landscapeVerticalFovDeg);
    const minHFovRad = THREE.MathUtils.degToRad(
      camCfg.portraitMinHorizontalFovDeg
    );
    const currentHFovRad = 2 * Math.atan(Math.tan(vFovRad / 2) * aspect);
    if (currentHFovRad < minHFovRad) {
      vFovRad = 2 * Math.atan(Math.tan(minHFovRad / 2) / aspect);
    }
    const vFovDeg = THREE.MathUtils.radToDeg(vFovRad);
    const hFovDeg = THREE.MathUtils.radToDeg(
      2 * Math.atan(Math.tan(vFovRad / 2) * aspect)
    );

    const isPhone = W < 768;
    const maxWidthRatio = isPhone
      ? fCfg.mobileMaxWidthRatio
      : fCfg.desktopMaxWidthRatio;

    const marginPx = fCfg.minMarginPx;
    const bandTopPx = Math.max(marginPx, rects.topReservedBottomPx + marginPx);
    const bandBottomPx = Math.min(
      H - marginPx,
      rects.bottomReservedTopPx - marginPx
    );
    const freeBandHeightPx = Math.max(96, bandBottomPx - bandTopPx);

    const lookAtVec = new THREE.Vector3(...camCfg.lookAt);
    const basePosVec = new THREE.Vector3(...camCfg.position);
    const baseRayVec = basePosVec.clone().sub(lookAtVec);

    const kin = this.getActiveKinematics();
    const parkedSample = kin.evaluate(kin.durationSec);
    const parkedMatrix = new THREE.Matrix4().makeRotationY(
      parkedSample.headingRad
    );

    const bMin = carMeta.boundingBox.min;
    const bMax = carMeta.boundingBox.max;

    const projectWorldPt = (pt: THREE.Vector3) => {
      const p = pt.clone().project(this.camera);
      return {
        x: (p.x * 0.5 + 0.5) * W,
        y: (-p.y * 0.5 + 0.5) * H,
      };
    };

    const measureParkedBounds = () => {
      const corners = [
        new THREE.Vector3(bMin[0], bMin[1], bMin[2]),
        new THREE.Vector3(bMax[0], bMin[1], bMin[2]),
        new THREE.Vector3(bMin[0], bMax[1], bMin[2]),
        new THREE.Vector3(bMax[0], bMax[1], bMin[2]),
        new THREE.Vector3(bMin[0], bMin[1], bMax[2]),
        new THREE.Vector3(bMax[0], bMin[1], bMax[2]),
        new THREE.Vector3(bMin[0], bMax[1], bMax[2]),
        new THREE.Vector3(bMax[0], bMax[1], bMax[2]),
      ];
      let minX = Infinity,
        maxX = -Infinity,
        minY = Infinity,
        maxY = -Infinity;
      for (const c of corners) {
        c.applyMatrix4(parkedMatrix);
        const sp = projectWorldPt(c);
        if (sp.x < minX) minX = sp.x;
        if (sp.x > maxX) maxX = sp.x;
        if (sp.y < minY) minY = sp.y;
        if (sp.y > maxY) maxY = sp.y;
      }
      return { minX, maxX, minY, maxY };
    };

    const measureMinArrivalRoofTopY = () => {
      let minTopY = Infinity;
      const steps = 16;
      for (let i = 0; i <= steps; i++) {
        const s = kin.evaluate((i / steps) * kin.durationSec);
        const m = new THREE.Matrix4()
          .makeRotationY(s.headingRad)
          .setPosition(s.x, 0, s.z);
        const roofFront = new THREE.Vector3(0, bMax[1], 0.4).applyMatrix4(m);
        const roofRear = new THREE.Vector3(0, bMax[1], -0.8).applyMatrix4(m);
        const y1 = projectWorldPt(roofFront).y;
        const y2 = projectWorldPt(roofRear).y;
        if (y1 < minTopY) minTopY = y1;
        if (y2 < minTopY) minTopY = y2;
      }
      return minTopY;
    };

    this.camera.fov = vFovDeg;
    this.camera.aspect = aspect;

    let distScale = 1.0;
    for (let iter = 0; iter < 5; iter++) {
      const pos = lookAtVec.clone().addScaledVector(baseRayVec, distScale);
      this.camera.position.copy(pos);
      this.camera.clearViewOffset();
      this.camera.lookAt(lookAtVec);
      this.camera.updateMatrixWorld(true);
      this.camera.updateProjectionMatrix();

      const box = measureParkedBounds();
      const curW = Math.max(1, box.maxX - box.minX);
      const curH = Math.max(1, box.maxY - box.minY);

      const scaleW = curW / (maxWidthRatio * W);
      const scaleH = curH / freeBandHeightPx;
      const needed = Math.max(scaleW, scaleH, 0.72 / distScale);
      distScale = Math.max(0.72, Math.min(3.6, distScale * needed));
    }

    let finalCamPos = lookAtVec.clone().addScaledVector(baseRayVec, distScale);
    this.camera.position.copy(finalCamPos);
    this.camera.clearViewOffset();
    this.camera.lookAt(lookAtVec);
    this.camera.updateMatrixWorld(true);
    this.camera.updateProjectionMatrix();

    let unshiftedBox = measureParkedBounds();
    let unshiftedArrivalMinTopY = measureMinArrivalRoofTopY();

    const combinedMinY = Math.min(unshiftedBox.minY, unshiftedArrivalMinTopY);
    const combinedSpanPx = unshiftedBox.maxY - combinedMinY;
    if (combinedSpanPx > freeBandHeightPx + 4) {
      const extraScale = combinedSpanPx / freeBandHeightPx;
      distScale = Math.min(3.8, distScale * extraScale);
      finalCamPos = lookAtVec.clone().addScaledVector(baseRayVec, distScale);
      this.camera.position.copy(finalCamPos);
      this.camera.lookAt(lookAtVec);
      this.camera.updateMatrixWorld(true);
      this.camera.updateProjectionMatrix();
      unshiftedBox = measureParkedBounds();
      unshiftedArrivalMinTopY = measureMinArrivalRoofTopY();
    }

    const unshiftedCenterX = (unshiftedBox.minX + unshiftedBox.maxX) / 2;
    const unshiftedCenterY = (unshiftedBox.minY + unshiftedBox.maxY) / 2;

    const deltaXPx = W * 0.5 - unshiftedCenterX;
    let deltaYPx = (bandTopPx + bandBottomPx) * 0.5 - unshiftedCenterY;

    const shiftedArrivalTopY = unshiftedArrivalMinTopY + deltaYPx;
    const minAllowedArrivalTopY = rects.topReservedBottomPx + 10;
    if (shiftedArrivalTopY < minAllowedArrivalTopY) {
      const pushDown = minAllowedArrivalTopY - shiftedArrivalTopY;
      const maxPushDownBeforeBottomTouch = Math.max(
        0,
        bandBottomPx - (unshiftedBox.maxY + deltaYPx)
      );
      deltaYPx += Math.min(pushDown, maxPushDownBeforeBottomTouch);
    }

    this.camera.setViewOffset(W, H, -deltaXPx, -deltaYPx, W, H);
    this.camera.updateProjectionMatrix();

    const finalBox = measureParkedBounds();
    const finalMinArrivalTopY = measureMinArrivalRoofTopY();

    if (renderNow && !this.isDisposed) {
      this.applyState(this.currentTimeSec);
      this.renderSingleFrame();
    }

    const telemetry: FramingTelemetry = {
      viewportWidth: W,
      viewportHeight: H,
      topReservedBottomPx: Math.round(rects.topReservedBottomPx),
      bottomReservedTopPx: Math.round(rects.bottomReservedTopPx),
      bandTopPx: Math.round(bandTopPx),
      bandBottomPx: Math.round(bandBottomPx),
      cameraDistanceScale: Number(distScale.toFixed(3)),
      cameraPosition: [
        Number(finalCamPos.x.toFixed(3)),
        Number(finalCamPos.y.toFixed(3)),
        Number(finalCamPos.z.toFixed(3)),
      ],
      verticalFovDeg: Number(vFovDeg.toFixed(2)),
      horizontalFovDeg: Number(hFovDeg.toFixed(2)),
      viewOffsetXPx: Number(deltaXPx.toFixed(1)),
      viewOffsetYPx: Number(deltaYPx.toFixed(1)),
      parkedBoxPx: {
        left: Math.round(finalBox.minX),
        top: Math.round(finalBox.minY),
        right: Math.round(finalBox.maxX),
        bottom: Math.round(finalBox.maxY),
        width: Math.round(finalBox.maxX - finalBox.minX),
        height: Math.round(finalBox.maxY - finalBox.minY),
        widthRatio: Number(((finalBox.maxX - finalBox.minX) / W).toFixed(3)),
      },
      minArrivalTopYPx: Math.round(finalMinArrivalTopY),
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
    };

    this.lastTelemetry = telemetry;
    return telemetry;
  }

  public getTextRevealStartSec(): number {
    return this.useMobileModel
      ? this.config.arrival.mobileTextRevealStartSec
      : this.config.arrival.desktopTextRevealStartSec;
  }

  public startArrival(fromTimeSec = 0): void {
    if (this.isDisposed) return;
    const duration = this.getDurationSec();

    if (fromTimeSec >= duration) {
      this.jumpToParkedAndStop(true);
      return;
    }

    if (fromTimeSec === 0) {
      notifyHeroArrivalStarted();
    }

    this.stopRenderLoop();
    this.guardAccumMs = 0;
    this.guardFrameCount = 0;
    this.guardChecked = fromTimeSec >= this.config.loading.frameGuardWindowSec;
    this.skipFirstDelta = true;

    const revealT = this.getTextRevealStartSec();
    this.textRevealFired = fromTimeSec >= revealT;
    if (this.textRevealFired) {
      this.onTextRevealChange?.("reveal");
    } else {
      this.onTextRevealChange?.("hidden");
    }

    this.applyState(fromTimeSec);
    this.renderSingleFrame();

    this.lastFramePerfMs = performance.now();
    this.rafId = window.requestAnimationFrame(this.tick);
  }

  public jumpToParkedAndStop(instantText = false): void {
    this.stopRenderLoop();
    if (this.isDisposed) return;
    const duration = this.getDurationSec();
    this.applyState(duration);
    this.renderSingleFrame();
    if (!this.textRevealFired || instantText) {
      this.textRevealFired = true;
      this.onTextRevealChange?.(instantText ? "instant" : "reveal");
    }
    notifyHeroArrivalCompleted();
  }

  public setScrubTime(tSeconds: number): ArrivalFrameSample {
    this.stopRenderLoop();
    const sample = this.applyState(tSeconds);
    const revealT = this.getTextRevealStartSec();
    this.textRevealFired = sample.t >= revealT;
    this.onTextRevealChange?.(
      sample.t >= this.getDurationSec()
        ? "instant"
        : sample.t >= revealT
          ? "reveal"
          : "hidden"
    );
    this.renderSingleFrame();
    return sample;
  }

  private stopRenderLoop(): void {
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private tick = (nowMs: number): void => {
    this.rafId = null;
    if (this.isDisposed) return;

    const rawDeltaMs = Math.max(0, nowMs - this.lastFramePerfMs);
    this.lastFramePerfMs = nowMs;

    if (this.skipFirstDelta) {
      this.skipFirstDelta = false;
    } else if (!this.guardChecked) {
      if (!document.hidden && rawDeltaMs > 0 && rawDeltaMs < 250) {
        this.guardAccumMs += rawDeltaMs;
        this.guardFrameCount++;
      }
      if (
        this.currentTimeSec >= this.config.loading.frameGuardWindowSec &&
        this.guardFrameCount >= 5
      ) {
        this.guardChecked = true;
        const avgFrameMs = this.guardAccumMs / this.guardFrameCount;
        if (avgFrameMs > this.config.loading.frameGuardMaxAvgMs) {
          this.jumpToParkedAndStop();
          return;
        }
      }
    }

    const dtSec = document.hidden ? 0 : Math.min(0.05, rawDeltaMs / 1000);
    const nextT = this.currentTimeSec + dtSec;
    const duration = this.getDurationSec();

    if (!this.textRevealFired && nextT >= this.getTextRevealStartSec()) {
      this.textRevealFired = true;
      this.onTextRevealChange?.("reveal");
    }

    if (nextT >= duration) {
      this.jumpToParkedAndStop(false);
      return;
    }

    this.applyState(nextT);
    this.renderSingleFrame();
    this.rafId = window.requestAnimationFrame(this.tick);
  };

  public renderSingleFrame(): void {
    if (this.isDisposed) return;
    this.renderer.render(this.scene, this.camera);
  }

  public isRenderLoopRunning(): boolean {
    return this.rafId !== null;
  }

  public getCurrentState(): ArrivalFrameSample {
    return this.lastSample;
  }

  public getFramingTelemetry(): FramingTelemetry | null {
    if (this.lastTelemetry) {
      this.lastTelemetry.drawCalls = this.renderer.info.render.calls;
      this.lastTelemetry.triangles = this.renderer.info.render.triangles;
      this.lastTelemetry.geometries = this.renderer.info.memory.geometries;
      this.lastTelemetry.textures = this.renderer.info.memory.textures;
    }
    return this.lastTelemetry;
  }

  public getCanvasElement(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  public dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    this.stopRenderLoop();

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    const canvas = this.renderer.domElement;
    canvas.removeEventListener(
      "webglcontextlost",
      this.handleContextLost,
      false
    );
    canvas.removeEventListener(
      "webglcontextrestored",
      this.handleContextRestored,
      false
    );

    this.groundShadows.dispose();

    if (this.carRig) {
      for (const m of this.carRig.materials) m.dispose();
      this.carRig.root.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry?.dispose();
          const mat = mesh.material;
          if (Array.isArray(mat)) {
            for (const mm of mat) mm.dispose();
          } else if (mat) {
            const std = mat as THREE.MeshStandardMaterial;
            std.map?.dispose();
            mat.dispose();
          }
        }
      });
      this.carRig = null;
    }

    this.envRenderTarget.dispose();
    this.dracoLoader.dispose();
    this.renderer.dispose();
    canvas.remove();
  }
}
