"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import carMeta from "@/lib/car-meta.generated.json";
import { HERO3D_CONFIG } from "@/lib/hero3d-config";
import {
  applyCarMaterialsAndRig,
  type RiggedCarNodes,
} from "@/lib/hero3d/car-materials";

type ModelVariant = "desktop" | "mobile" | "both";

export default function DevModelViewerPage() {
  const mountRef = useRef<HTMLDivElement | null>(null);

  const [variant, setVariant] = useState<ModelVariant>("both");
  const [wheelSpinActive, setWheelSpinActive] = useState(false);
  const [steerDeg, setSteerDeg] = useState(0);
  const [showHelpers, setShowHelpers] = useState(true);
  const [loadState, setLoadState] = useState<{
    desktopLoaded: boolean;
    mobileLoaded: boolean;
    desktopNodes: string[];
    mobileNodes: string[];
    error: string | null;
  }>({
    desktopLoaded: false,
    mobileLoaded: false,
    desktopNodes: [],
    mobileNodes: [],
    error: null,
  });

  const spinRef = useRef(wheelSpinActive);
  spinRef.current = wheelSpinActive;

  const steerRadRef = useRef(0);
  steerRadRef.current = THREE.MathUtils.degToRad(steerDeg);

  const variantRef = useRef<ModelVariant>(variant);
  variantRef.current = variant;

  const helpersRef = useRef(showHelpers);
  helpersRef.current = showHelpers;

  const desktopRigRef = useRef<RiggedCarNodes | null>(null);
  const mobileRigRef = useRef<RiggedCarNodes | null>(null);
  const helperGroupRef = useRef<THREE.Group | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 1280;
    const height = container.clientHeight || 680;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    // Neutral studio grey background (#1e222a) as requested
    scene.background = new THREE.Color("#1e222a");

    // Procedural studio environment map so clearcoat & dark rims reflect realistically
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTex = pmremGenerator.fromScene(roomEnv, 0.04).texture;
    scene.environment = envTex;

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(4.2, 1.85, 5.6);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.target.set(0, 0.55, 0);
    controls.update();

    // Studio key, rim & fill lighting
    const hemiLight = new THREE.HemisphereLight(0xdbe8ff, 0x10141c, 1.35);
    scene.add(hemiLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 2.4);
    dirLight1.position.set(5, 8, 6);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x7faeff, 1.8);
    dirLight2.position.set(-6, 5, -5);
    scene.add(dirLight2);

    // Ground grid at y = 0.0000 to verify wheel bottoms touch y = 0 with zero floating
    const grid = new THREE.GridHelper(14, 28, 0x2f6bff, 0x353c49);
    grid.position.y = 0;
    scene.add(grid);

    const helperGroup = new THREE.Group();
    scene.add(helperGroup);
    helperGroupRef.current = helperGroup;

    const axes = new THREE.AxesHelper(1.2);
    axes.position.set(0, 0.002, 0);
    helperGroup.add(axes);

    // Load both GLBs using self-hosted Draco decoder at /draco/
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath(HERO3D_CONFIG.assets.dracoDecoderPath);

    const gltfLoader = new GLTFLoader();
    gltfLoader.setDRACOLoader(dracoLoader);

    let disposed = false;

    const inspectRigNodes = (rig: RiggedCarNodes): string[] => {
      const names = [
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
      ] as const;
      return names.filter((k) => Boolean(rig[k]));
    };

    const addMarkersForCar = (rig: RiggedCarNodes, xOffset: number) => {
      // Headlight lamp markers (electric blue spheres)
      const hlGeo = new THREE.SphereGeometry(0.045, 16, 16);
      const hlMat = new THREE.MeshBasicMaterial({ color: 0x2f6bff });
      for (const side of ["left", "right"] as const) {
        const [lx, ly, lz] = carMeta.headlightLamps[side];
        const m = new THREE.Mesh(hlGeo, hlMat);
        m.position.set(lx + xOffset, ly, lz);
        helperGroup.add(m);
      }

      // Center of mass marker (amber sphere)
      const comGeo = new THREE.SphereGeometry(0.06, 16, 16);
      const comMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
      const comMesh = new THREE.Mesh(comGeo, comMat);
      comMesh.position.set(xOffset, carMeta.centerOfMassHeight, 0);
      helperGroup.add(comMesh);

      // Bounding box helper
      const box = new THREE.Box3().setFromObject(rig.root);
      const boxHelper = new THREE.Box3Helper(box, new THREE.Color(0x38bdf8));
      helperGroup.add(boxHelper);
    };

    Promise.all([
      gltfLoader.loadAsync(HERO3D_CONFIG.assets.desktopGlb),
      gltfLoader.loadAsync(HERO3D_CONFIG.assets.mobileGlb),
    ])
      .then(([desktopGltf, mobileGltf]) => {
        if (disposed) return;

        const dRig = applyCarMaterialsAndRig(desktopGltf.scene, HERO3D_CONFIG);
        const mRig = applyCarMaterialsAndRig(mobileGltf.scene, HERO3D_CONFIG);

        // Position side-by-side when viewing "both" (-1.45 m left for desktop, +1.45 m right for mobile)
        dRig.root.position.set(-1.45, 0, 0);
        mRig.root.position.set(1.45, 0, 0);

        scene.add(dRig.root);
        scene.add(mRig.root);

        desktopRigRef.current = dRig;
        mobileRigRef.current = mRig;

        addMarkersForCar(dRig, -1.45);
        addMarkersForCar(mRig, 1.45);

        setLoadState({
          desktopLoaded: true,
          mobileLoaded: true,
          desktopNodes: inspectRigNodes(dRig),
          mobileNodes: inspectRigNodes(mRig),
          error: null,
        });
      })
      .catch((err: unknown) => {
        if (disposed) return;
        setLoadState((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : String(err),
        }));
      });

    let rafId = 0;
    let wheelAngle = 0;
    let lastTime = performance.now();

    const animate = (now: number) => {
      if (disposed) return;
      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      if (spinRef.current) {
        // Simulate forward driving at ~15 km/h (v = 4.16 m/s -> omega = v / R = 11.4 rad/s)
        wheelAngle += dt * (4.16 / carMeta.wheelRadius);
      }

      const dRig = desktopRigRef.current;
      const mRig = mobileRigRef.current;
      const curVariant = variantRef.current;

      if (dRig) {
        dRig.root.visible = curVariant === "desktop" || curVariant === "both";
        dRig.root.position.x = curVariant === "both" ? -1.45 : 0;
      }
      if (mRig) {
        mRig.root.visible = curVariant === "mobile" || curVariant === "both";
        mRig.root.position.x = curVariant === "both" ? 1.45 : 0;
      }
      if (helperGroupRef.current) {
        helperGroupRef.current.visible =
          helpersRef.current && curVariant === "both";
      }

      for (const rig of [dRig, mRig]) {
        if (!rig) continue;
        // Rolling rotation around local X axis (+X rotation rolls top of wheel toward +Z forward)
        if (rig.wheel_FL) rig.wheel_FL.rotation.x = wheelAngle;
        if (rig.wheel_FR) rig.wheel_FR.rotation.x = wheelAngle;
        if (rig.wheel_RL) rig.wheel_RL.rotation.x = wheelAngle;
        if (rig.wheel_RR) rig.wheel_RR.rotation.x = wheelAngle;

        // Steering rotation around parent steer_FL / steer_FR Y axis
        if (rig.steer_FL) rig.steer_FL.rotation.y = steerRadRef.current;
        if (rig.steer_FR) rig.steer_FR.rotation.y = steerRadRef.current;
      }

      controls.update();
      renderer.render(scene, camera);
      rafId = window.requestAnimationFrame(animate);
    };

    rafId = window.requestAnimationFrame(animate);

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || 1280;
      const h = container.clientHeight || 680;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
      controls.dispose();
      dracoLoader.dispose();
      envTex.dispose();
      roomEnv.dispose();
      pmremGenerator.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#12151b] text-[#F4F1EC] flex flex-col">
      {/* Top Control & Telemetry Header */}
      <header className="border-b border-white/10 bg-[#171b22] px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-mono uppercase tracking-widest text-[#2F6BFF]">
            W1 · 3D Asset Pipeline &amp; Rig Verification
          </span>
          <h1 className="text-lg font-semibold text-white">
            /dev/model — {carMeta.modelName} (Desktop &amp; Mobile Lite GLBs)
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Model selector */}
          <div className="inline-flex rounded-lg border border-white/15 bg-black/30 p-1 text-xs">
            {(["both", "desktop", "mobile"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                data-testid={`mode-${mode}`}
                onClick={() => setVariant(mode)}
                className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                  variant === mode
                    ? "bg-[#2F6BFF] text-white"
                    : "text-silver hover:text-white"
                }`}
              >
                {mode === "both"
                  ? "Both Side-by-Side"
                  : mode === "desktop"
                  ? `Desktop (${carMeta.outputs.desktop.sizeMB} MB)`
                  : `Mobile Lite (${carMeta.outputs.mobile.sizeMB} MB)`}
              </button>
            ))}
          </div>

          {/* Wheel Rotation Test Button */}
          <button
            type="button"
            data-testid="toggle-wheel-rotation"
            onClick={() => setWheelSpinActive((v) => !v)}
            className={`rounded-lg border px-4 py-2 text-xs font-semibold transition-colors ${
              wheelSpinActive
                ? "border-emerald-400 bg-emerald-500/20 text-emerald-200"
                : "border-[#2F6BFF] bg-[#2F6BFF]/15 text-white hover:bg-[#2F6BFF]/30"
            }`}
          >
            {wheelSpinActive
              ? "⟳ Wheel Rotation: ON (Rolling +Z)"
              : "▶ Test Wheel Rotation"}
          </button>

          {/* Steering angle slider */}
          <label className="flex items-center gap-2 rounded-lg border border-white/15 bg-black/30 px-3 py-1.5 text-xs">
            <span className="text-silver">Steer:</span>
            <input
              type="range"
              min={-28}
              max={28}
              step={1}
              value={steerDeg}
              onChange={(e) => setSteerDeg(Number(e.target.value))}
              className="w-20 accent-[#2F6BFF]"
            />
            <span className="w-9 text-right font-mono">{steerDeg}&deg;</span>
          </label>

          {/* Bounding box & lamp helpers toggle */}
          <button
            type="button"
            onClick={() => setShowHelpers((v) => !v)}
            className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-xs text-silver hover:text-white"
          >
            {showHelpers ? "Hide Helpers" : "Show Helpers"}
          </button>
        </div>
      </header>

      {/* Main Split View: 3D Orbit Canvas + Measured Values Panel */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_410px] min-h-[640px]">
        {/* 3D Canvas Stage */}
        <div className="relative bg-[#1e222a] min-h-[540px]">
          <div
            ref={mountRef}
            data-testid="model-viewer-canvas"
            className="absolute inset-0"
          />

          {/* Overlay Legend */}
          <div className="pointer-events-none absolute left-4 bottom-4 flex flex-wrap items-center gap-3 rounded-lg border border-white/10 bg-black/65 px-3.5 py-2 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#38bdf8]" />
              Left: <strong>hero-car.glb</strong> (
              {carMeta.outputs.desktop.triangles.toLocaleString()} tris ·{" "}
              {carMeta.outputs.desktop.sizeMB} MB)
            </span>
            <span className="text-white/30">|</span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              Right: <strong>hero-car-lite.glb</strong> (
              {carMeta.outputs.mobile.triangles.toLocaleString()} tris ·{" "}
              {carMeta.outputs.mobile.sizeMB} MB · Interior Removed)
            </span>
          </div>
        </div>

        {/* Measured Values & Node Rig Sidebar */}
        <aside className="border-l border-white/10 bg-[#151921] p-5 overflow-y-auto space-y-5 text-xs">
          {/* Load Status */}
          <div className="rounded-lg border border-white/10 bg-black/30 p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white">
                GLB &amp; Draco Status
              </span>
              <span
                data-testid="glb-load-status"
                className={`rounded px-2 py-0.5 font-mono text-[11px] ${
                  loadState.desktopLoaded && loadState.mobileLoaded
                    ? "bg-emerald-500/20 text-emerald-300"
                    : loadState.error
                    ? "bg-red-500/20 text-red-300"
                    : "bg-amber-500/20 text-amber-300"
                }`}
              >
                {loadState.desktopLoaded && loadState.mobileLoaded
                  ? "BOTH GLBS LOADED"
                  : loadState.error
                  ? "ERROR"
                  : "LOADING..."}
              </span>
            </div>
            {loadState.error && (
              <p className="text-red-400 font-mono">{loadState.error}</p>
            )}
            <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
              <div className="rounded bg-white/5 p-2">
                <div className="text-silver">Desktop GLB</div>
                <div className="text-white font-semibold">
                  {carMeta.outputs.desktop.sizeMB} MB (&le; 6 MB)
                </div>
                <div className="text-emerald-300">
                  {carMeta.outputs.desktop.triangles.toLocaleString()} tris
                </div>
              </div>
              <div className="rounded bg-white/5 p-2">
                <div className="text-silver">Mobile Lite GLB</div>
                <div className="text-white font-semibold">
                  {carMeta.outputs.mobile.sizeMB} MB (&le; 2.5 MB)
                </div>
                <div className="text-emerald-300">
                  {carMeta.outputs.mobile.triangles.toLocaleString()} tris
                </div>
              </div>
            </div>
          </div>

          {/* Measured Dimensions & Kinematics */}
          <div className="rounded-lg border border-white/10 bg-black/30 p-3.5 space-y-2">
            <h2 className="font-semibold text-white">
              Measured Geometry (/lib/car-meta.generated.json)
            </h2>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 font-mono text-[11px]">
              <dt className="text-silver">Dimensions (W×H×L):</dt>
              <dd className="text-white text-right">
                {carMeta.boundingBox.size[0]} × {carMeta.boundingBox.size[1]} ×{" "}
                {carMeta.boundingBox.size[2]} m
              </dd>
              <dt className="text-silver">Ground Contact Y:</dt>
              <dd className="text-emerald-300 text-right">
                y = {carMeta.boundingBox.min[1].toFixed(4)} m
              </dd>
              <dt className="text-silver">Wheel Radius:</dt>
              <dd className="text-white text-right">{carMeta.wheelRadius} m</dd>
              <dt className="text-silver">Wheelbase:</dt>
              <dd className="text-white text-right">{carMeta.wheelbase} m</dd>
              <dt className="text-silver">Track Width:</dt>
              <dd className="text-white text-right">{carMeta.trackWidth} m</dd>
              <dt className="text-silver">CoM Height Est.:</dt>
              <dd className="text-white text-right">
                {carMeta.centerOfMassHeight} m
              </dd>
              <dt className="text-silver">Forward / Up:</dt>
              <dd className="text-white text-right">
                {carMeta.forwardAxis} / {carMeta.upAxis}
              </dd>
            </dl>
          </div>

          {/* Wheel Centers & Lamp Positions */}
          <div className="rounded-lg border border-white/10 bg-black/30 p-3.5 space-y-2 font-mono text-[11px]">
            <h2 className="font-sans font-semibold text-white">
              Wheel Centers &amp; Headlight Lamp Anchors (m)
            </h2>
            <div className="space-y-1">
              {Object.entries(carMeta.wheelCenters).map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-silver">wheel_{k} center:</span>
                  <span className="text-white">[{v.join(", ")}]</span>
                </div>
              ))}
              <div className="border-t border-white/10 my-1.5 pt-1.5 flex justify-between">
                <span className="text-[#2F6BFF]">headlight.left:</span>
                <span className="text-white">
                  [{carMeta.headlightLamps.left.join(", ")}]
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#2F6BFF]">headlight.right:</span>
                <span className="text-white">
                  [{carMeta.headlightLamps.right.join(", ")}]
                </span>
              </div>
            </div>
          </div>

          {/* Named Hierarchy Verification */}
          <div className="rounded-lg border border-white/10 bg-black/30 p-3.5 space-y-2">
            <h2 className="font-semibold text-white">
              Verified Named Node Hierarchy (12/12)
            </h2>
            <div className="flex flex-wrap gap-1.5 font-mono text-[11px]">
              {carMeta.nodeNames.map((name) => {
                const present = loadState.desktopNodes.includes(name);
                return (
                  <span
                    key={name}
                    className={`rounded px-2 py-0.5 ${
                      present
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : "bg-white/5 text-silver"
                    }`}
                  >
                    {present ? "✓ " : ""}
                    {name}
                  </span>
                );
              })}
            </div>
          </div>

          {/* License & Attribution */}
          <div className="rounded-lg border border-white/10 bg-black/30 p-3.5 space-y-1 text-[11px] text-silver">
            <div className="font-semibold text-white">
              Attribution &amp; License
            </div>
            <p>
              <strong>{carMeta.modelName}</strong> by{" "}
              <strong>{carMeta.author}</strong> · License:{" "}
              <strong>{carMeta.license}</strong>
            </p>
            <p className="text-silver/75 break-all">{carMeta.sourceUrl}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
