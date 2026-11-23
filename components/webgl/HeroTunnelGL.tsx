"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { gsap } from "@/lib/gsap";
import { HERO_MOTION } from "@/lib/hero-motion";

export interface HeroTunnelGLProps {
  /** Called once the first WebGL frame has rendered so the parent can cross-fade & pause the CSS tunnel */
  onReady: () => void;
  /** Called when the quality governor degrades to CSS or WebGL context is lost */
  onFallbackToCss: (reason: string) => void;
  /** Whether the hero intro has already completed in this page session */
  skipIntroRamp: boolean;
}

/**
 * Session-level sticky degradation flag: once the quality governor degrades to CSS,
 * never flip-flop back to WebGL during the session.
 */
let sessionDegradedToCss = false;

export function isWebGLSessionDegraded(): boolean {
  return sessionDegradedToCss;
}

function parseCssColorToRgb(cssColor: string, fallbackHex = "#0b121a"): THREE.Color {
  const trimmed = cssColor.trim();
  try {
    return new THREE.Color(trimmed || fallbackHex);
  } catch {
    return new THREE.Color(fallbackHex);
  }
}

/**
 * Capable-Desktop WebGL2 Showroom Light Tunnel (/components/webgl/HeroTunnelGL.tsx):
 * - Transparent canvas (alpha: true, premultipliedAlpha: true, antialias: false,
 *   powerPreference: "high-performance", clear alpha 0).
 * - PerspectiveCamera (fov 38) placed at headlight height, using camera.setViewOffset
 *   so the 3D vanishing point (0, 0, -Z) lands at the exact measured (--vp-x, --vp-y) coordinate
 *   matching the CSS tunnel.
 * - 5 single-draw-call GPU layers (all instance z positions computed in vertex shaders via
 *   mod(aBaseZ - uTravel, uRange), zero per-instance CPU updates):
 *   1) Ceiling bars: InstancedMesh of 24 thin planes with emissive core, soft ends, exp2 fog, and red accent every 8th.
 *   2) Floor reflections: InstancedMesh of 24 mirrored bars under --floor-y with alpha 0.20,
 *      stretched procedural Z-roughness smear, distance attenuation, and horizon Fresnel boost.
 *   3) Wall rails & wall fins: InstancedMesh combining the 2 continuous side rails + 24 flowing wall fins.
 *   4) Additive bloom sprites: InstancedMesh of 24 soft gradient halos around each ceiling bar head.
 *   5) Haze: one big camera-facing quad with a 3-octave navy-teal noise fog drifting on a 60s cycle (opacity <= 0.12),
 *      rendered into a dedicated 0.6x resolution WebGLRenderTarget (and updated at 30 Hz since the cycle is 60s).
 * - Quality governor: rolling 30-frame window (> 22ms threshold):
 *   Stage 1 -> disable haze quad; Stage 2 -> reduce DPR to 1.0; Stage 3 -> cross-fade (0.6s) to CSS tunnel & dispose.
 */
export default function HeroTunnelGL({
  onReady,
  onFallbackToCss,
  skipIntroRamp,
}: HeroTunnelGLProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionDegradedToCss) {
      onFallbackToCss("session-already-degraded");
      return;
    }

    const container = wrapRef.current;
    if (!container) return;

    const heroEl =
      (container.closest(".hero-stage") as HTMLElement | null) ?? container;

    const { tunnel } = HERO_MOTION;
    const { webgl, geometry, opacity } = tunnel;
    const D = tunnel.barSpacing; // 420
    const N = webgl.barCount; // 24
    const totalRange = N * D; // 10080
    const firstBarZ = geometry.firstBarZ; // 240
    const baseSpeed = D / tunnel.duration.desktop; // 420 / 8.0 = 52.5 world px/s

    // Create canvas manually so React Strict Mode mount/unmount/mount never leaves duplicate canvases
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.setAttribute("data-hero-tunnel-gl", "active");
    canvas.className = "pointer-events-none block h-full w-full";
    container.innerHTML = "";
    container.appendChild(canvas);

    let glContext: WebGL2RenderingContext | null = null;
    try {
      glContext = canvas.getContext("webgl2", {
        alpha: true,
        premultipliedAlpha: true,
        antialias: false,
        powerPreference: "high-performance",
        depth: false,
        stencil: false,
      }) as WebGL2RenderingContext | null;
    } catch {
      glContext = null;
    }

    if (!glContext) {
      canvas.remove();
      onFallbackToCss("webgl2-context-unavailable");
      return;
    }

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        context: glContext,
        alpha: true,
        premultipliedAlpha: true,
        antialias: false,
        powerPreference: "high-performance",
        depth: false,
        stencil: false,
      });
    } catch {
      canvas.remove();
      onFallbackToCss("renderer-init-failed");
      return;
    }

    renderer.setClearColor(0x000000, 0);
    renderer.autoClear = true;

    const scene = new THREE.Scene();

    // Camera at (0, 0, 0) looking down -Z; fov = 38 deg
    const camera = new THREE.PerspectiveCamera(webgl.fov, 16 / 9, 20, 11500);
    camera.position.set(0, 0, 0);
    camera.lookAt(0, 0, -1000);

    // Read --hero-bg color from CSS so fog blends seamlessly with the page
    const readHeroBgColor = (): THREE.Color => {
      const raw =
        getComputedStyle(heroEl).getPropertyValue("--hero-bg") ||
        getComputedStyle(document.documentElement).getPropertyValue("--hero-bg") ||
        "#0b121a";
      return parseCssColorToRgb(raw, "#0b121a");
    };

    const fogColor = readHeroBgColor();
    const silverColor = new THREE.Color(190 / 255, 210 / 255, 230 / 255);
    const redColor = new THREE.Color("#C8102E");

    // Shared uniforms updated once per frame (zero per-instance CPU updates)
    const sharedUniforms = {
      uTime: { value: 0 },
      uTravel: { value: 0 },
      uRange: { value: totalRange },
      uFirstZ: { value: firstBarZ },
      uFogColor: { value: fogColor },
      uSilverColor: { value: silverColor },
      uRedColor: { value: redColor },
      uFloorY: { value: -235.0 },
      uCeilingY: { value: Math.abs(geometry.ceilingOffsetY) },
      uHalfWidth: { value: 920.0 },
      uBarWidth: { value: 1950.0 },
    };

    const disposables: Array<{ dispose: () => void }> = [];

    // Helper to build per-instance attributes (aBaseZ, aIsRed)
    const createBarAttributes = (geom: THREE.InstancedBufferGeometry, count: number) => {
      const baseZArr = new Float32Array(count);
      const isRedArr = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        baseZArr[i] = i * D;
        isRedArr[i] = (i + 1) % tunnel.redEvery === 0 ? 1.0 : 0.0;
      }
      geom.setAttribute("aBaseZ", new THREE.InstancedBufferAttribute(baseZArr, 1));
      geom.setAttribute("aIsRed", new THREE.InstancedBufferAttribute(isRedArr, 1));
    };

    // =========================================================================
    // 1. CEILING LIGHT BARS (InstancedMesh, 24 instances, 1 draw call)
    // =========================================================================
    const basePlane = new THREE.PlaneGeometry(1, 1);
    disposables.push(basePlane);

    const ceilingGeo = new THREE.InstancedBufferGeometry();
    ceilingGeo.index = basePlane.index;
    ceilingGeo.attributes = basePlane.attributes;
    ceilingGeo.instanceCount = N;
    createBarAttributes(ceilingGeo, N);
    disposables.push(ceilingGeo);

    const ceilingMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.NormalBlending,
      uniforms: {
        ...sharedUniforms,
        uBarOpacity: { value: opacity.ceilingBarDesktop },
        uRedOpacity: { value: opacity.redBar },
      },
      vertexShader: /* glsl */ `
        attribute float aBaseZ;
        attribute float aIsRed;
        uniform float uTravel;
        uniform float uRange;
        uniform float uFirstZ;
        uniform float uCeilingY;
        uniform float uBarWidth;
        varying vec2 vUv;
        varying float vIsRed;
        varying float vDist;

        void main() {
          vUv = uv;
          vIsRed = aIsRed;
          float wrappedOffset = mod(aBaseZ - uTravel, uRange);
          float zPos = uFirstZ - wrappedOffset;
          vDist = max(0.0, -zPos);

          vec3 localPos = vec3(
            position.x * uBarWidth,
            uCeilingY + position.y * 28.0,
            zPos + position.y * 22.0
          );
          gl_Position = projectionMatrix * modelViewMatrix * vec4(localPos, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uFogColor;
        uniform vec3 uSilverColor;
        uniform vec3 uRedColor;
        uniform float uBarOpacity;
        uniform float uRedOpacity;
        varying vec2 vUv;
        varying float vIsRed;
        varying float vDist;

        void main() {
          float xDist = abs(vUv.x - 0.5) * 2.0;
          float horizFade = smoothstep(1.0, 0.14, xDist);
          float coreBoost = smoothstep(0.65, 0.0, xDist) * 0.25;

          float yDist = abs(vUv.y - 0.5) * 2.0;
          float coreLine = exp(-yDist * yDist * 14.0);
          float softHalo = exp(-yDist * yDist * 3.2) * 0.45;
          float vertProfile = clamp(coreLine + softHalo, 0.0, 1.0);

          float fogFactor = exp2(-0.00024 * vDist * 1.442695);
          float farFade = smoothstep(9200.0, 600.0, vDist);

          vec3 baseCol = mix(uSilverColor, uRedColor, vIsRed);
          vec3 emissiveCol = mix(uFogColor, baseCol * (1.08 + coreBoost), fogFactor);
          float targetOp = mix(uBarOpacity, uRedOpacity, vIsRed);
          float alpha = horizFade * vertProfile * fogFactor * farFade * targetOp;

          gl_FragColor = vec4(emissiveCol * alpha, alpha);
        }
      `,
    });
    disposables.push(ceilingMat);

    const ceilingMesh = new THREE.Mesh(ceilingGeo, ceilingMat);
    ceilingMesh.frustumCulled = false;
    ceilingMesh.renderOrder = 2;
    scene.add(ceilingMesh);

    // =========================================================================
    // 2. SOFT ADDITIVE BLOOM SPRITES AROUND BAR HEADS (InstancedMesh, 24 instances, 1 draw call)
    // =========================================================================
    const bloomGeo = new THREE.InstancedBufferGeometry();
    bloomGeo.index = basePlane.index;
    bloomGeo.attributes = basePlane.attributes;
    bloomGeo.instanceCount = N;
    createBarAttributes(bloomGeo, N);
    disposables.push(bloomGeo);

    const bloomMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.NormalBlending,
      uniforms: {
        ...sharedUniforms,
        uBloomOpacity: { value: webgl.bloomOpacity },
      },
      vertexShader: /* glsl */ `
        attribute float aBaseZ;
        attribute float aIsRed;
        uniform float uTravel;
        uniform float uRange;
        uniform float uFirstZ;
        uniform float uCeilingY;
        uniform float uBarWidth;
        varying vec2 vUv;
        varying float vIsRed;
        varying float vDist;

        void main() {
          vUv = uv;
          vIsRed = aIsRed;
          float wrappedOffset = mod(aBaseZ - uTravel, uRange);
          float zPos = uFirstZ - wrappedOffset;
          vDist = max(0.0, -zPos);

          vec3 localPos = vec3(
            position.x * (uBarWidth * 1.04),
            uCeilingY + position.y * 88.0,
            zPos + position.y * 44.0
          );
          gl_Position = projectionMatrix * modelViewMatrix * vec4(localPos, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uFogColor;
        uniform vec3 uSilverColor;
        uniform vec3 uRedColor;
        uniform float uBloomOpacity;
        varying vec2 vUv;
        varying float vIsRed;
        varying float vDist;

        void main() {
          vec2 p = (vUv - 0.5) * 2.0;
          float radial = exp(-dot(p * vec2(1.05, 1.8), p * vec2(1.05, 1.8)) * 2.8);
          float headWeight = 0.65 + 0.55 * smoothstep(0.15, 0.72, abs(p.x));
          float fogFactor = exp2(-0.00028 * vDist * 1.442695);
          vec3 col = mix(uSilverColor, uRedColor, vIsRed);
          vec3 finalCol = mix(uFogColor, col, fogFactor);
          float alpha = radial * headWeight * fogFactor * uBloomOpacity;
          gl_FragColor = vec4(finalCol * alpha, alpha);
        }
      `,
    });
    disposables.push(bloomMat);

    const bloomMesh = new THREE.Mesh(bloomGeo, bloomMat);
    bloomMesh.frustumCulled = false;
    bloomMesh.renderOrder = 1;
    scene.add(bloomMesh);

    // =========================================================================
    // 3. FLOOR REFLECTIONS (InstancedMesh, 24 instances, 1 draw call)
    //    Mirrored under --floor-y with alpha 0.2, Z-stretched roughness smear & horizon Fresnel
    // =========================================================================
    const floorGeo = new THREE.InstancedBufferGeometry();
    floorGeo.index = basePlane.index;
    floorGeo.attributes = basePlane.attributes;
    floorGeo.instanceCount = N;
    createBarAttributes(floorGeo, N);
    disposables.push(floorGeo);

    const floorMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.NormalBlending,
      uniforms: {
        ...sharedUniforms,
        uFloorAlpha: { value: webgl.floorAlpha },
      },
      vertexShader: /* glsl */ `
        attribute float aBaseZ;
        attribute float aIsRed;
        uniform float uTravel;
        uniform float uRange;
        uniform float uFirstZ;
        uniform float uFloorY;
        uniform float uBarWidth;
        varying vec2 vUv;
        varying float vIsRed;
        varying float vDist;
        varying vec3 vWorldPos;

        void main() {
          vUv = uv;
          vIsRed = aIsRed;
          float wrappedOffset = mod(aBaseZ - uTravel, uRange);
          float zPos = uFirstZ - wrappedOffset;
          vDist = max(0.0, -zPos);

          vec3 localPos = vec3(
            position.x * uBarWidth,
            uFloorY + position.y * 32.0,
            zPos + position.y * 150.0
          );
          vWorldPos = localPos;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(localPos, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uFogColor;
        uniform vec3 uSilverColor;
        uniform vec3 uRedColor;
        uniform float uFloorAlpha;
        varying vec2 vUv;
        varying float vIsRed;
        varying float vDist;
        varying vec3 vWorldPos;

        void main() {
          float xDist = abs(vUv.x - 0.5) * 2.0;
          float horizFade = smoothstep(1.0, 0.16, xDist);

          float yDist = abs(vUv.y - 0.5) * 2.0;
          float smearProfile = exp(-yDist * yDist * 4.2);

          // Anisotropic Z-stretched wet-asphalt micro-roughness (sinusoidal interference along X/Z)
          float n1 = sin(vWorldPos.x * 0.042 + sin(vWorldPos.z * 0.006) * 2.2) * 0.5 + 0.5;
          float n2 = cos(vWorldPos.x * 0.095 - vWorldPos.z * 0.012) * 0.5 + 0.5;
          float roughnessSmear = 0.74 + 0.38 * (0.65 * n1 + 0.35 * n2);

          // Fresnel term near horizon + fade near viewer
          float viewGrazing = clamp(vDist / (vDist + 900.0), 0.0, 1.0);
          float fresnel = 0.48 + 0.72 * (viewGrazing * viewGrazing);
          float nearViewerFade = smoothstep(180.0, 950.0, vDist);
          float fogFactor = exp2(-0.00026 * vDist * 1.442695);

          vec3 col = mix(uSilverColor, uRedColor, vIsRed);
          vec3 finalCol = mix(uFogColor, col, fogFactor);
          float alpha = horizFade * smearProfile * roughnessSmear * fresnel * nearViewerFade * fogFactor * uFloorAlpha;

          gl_FragColor = vec4(finalCol * alpha, alpha);
        }
      `,
    });
    disposables.push(floorMat);

    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.frustumCulled = false;
    floorMesh.renderOrder = 2;
    scene.add(floorMesh);

    // =========================================================================
    // 4. WALL RAILS & WALL FINS (InstancedMesh, 26 instances = 2 static rails + 24 flowing fins, 1 draw call)
    // =========================================================================
    const totalWallInstances = 2 + webgl.wallFinPairs * 2; // 26
    const wallGeo = new THREE.InstancedBufferGeometry();
    wallGeo.index = basePlane.index;
    wallGeo.attributes = basePlane.attributes;
    wallGeo.instanceCount = totalWallInstances;

    const wallBaseZ = new Float32Array(totalWallInstances);
    const wallSide = new Float32Array(totalWallInstances);
    const wallKind = new Float32Array(totalWallInstances);

    wallBaseZ[0] = 0;
    wallSide[0] = -1;
    wallKind[0] = 0;

    wallBaseZ[1] = 0;
    wallSide[1] = 1;
    wallKind[1] = 0;

    let idx = 2;
    for (let f = 0; f < webgl.wallFinPairs; f++) {
      const zOffset = f * (2 * D);
      wallBaseZ[idx] = zOffset;
      wallSide[idx] = -1;
      wallKind[idx] = 1;
      idx++;

      wallBaseZ[idx] = zOffset;
      wallSide[idx] = 1;
      wallKind[idx] = 1;
      idx++;
    }

    wallGeo.setAttribute("aBaseZ", new THREE.InstancedBufferAttribute(wallBaseZ, 1));
    wallGeo.setAttribute("aSide", new THREE.InstancedBufferAttribute(wallSide, 1));
    wallGeo.setAttribute("aKind", new THREE.InstancedBufferAttribute(wallKind, 1));
    disposables.push(wallGeo);

    const wallMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.NormalBlending,
      uniforms: {
        ...sharedUniforms,
        uRailOpacity: { value: opacity.sideRail },
        uFinOpacity: { value: opacity.wallFin },
        uRailY: { value: Math.abs(geometry.sideRailOffsetY) },
      },
      vertexShader: /* glsl */ `
        attribute float aBaseZ;
        attribute float aSide;
        attribute float aKind;
        uniform float uTravel;
        uniform float uRange;
        uniform float uFirstZ;
        uniform float uHalfWidth;
        uniform float uRailY;
        varying vec2 vUv;
        varying float vKind;
        varying float vDist;

        void main() {
          vUv = uv;
          vKind = aKind;
          float wallX = aSide * uHalfWidth;

          vec3 localPos;
          if (aKind < 0.5) {
            float railZ = mix(180.0, -7800.0, uv.x);
            vDist = max(0.0, -railZ);
            localPos = vec3(
              wallX - aSide * (position.y * 8.0),
              uRailY + position.y * 5.5,
              railZ
            );
          } else {
            float wrappedOffset = mod(aBaseZ - uTravel, uRange);
            float finZ = uFirstZ - wrappedOffset;
            vDist = max(0.0, -finZ);
            localPos = vec3(
              wallX - aSide * (position.x * 16.0),
              uRailY + 35.0 + position.y * 230.0,
              finZ + position.x * 26.0
            );
          }

          gl_Position = projectionMatrix * modelViewMatrix * vec4(localPos, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uFogColor;
        uniform vec3 uSilverColor;
        uniform float uRailOpacity;
        uniform float uFinOpacity;
        varying vec2 vUv;
        varying float vKind;
        varying float vDist;

        void main() {
          float fogFactor = exp2(-0.00025 * vDist * 1.442695);
          vec3 col = mix(uFogColor, uSilverColor, fogFactor);

          float alpha;
          if (vKind < 0.5) {
            float yCore = exp(-pow((vUv.y - 0.5) * 2.0, 2.0) * 5.0);
            float zEnds = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.25, vUv.x);
            alpha = yCore * zEnds * fogFactor * uRailOpacity;
          } else {
            float xCore = exp(-pow((vUv.x - 0.5) * 2.0, 2.0) * 4.5);
            float yEnds = smoothstep(0.0, 0.22, vUv.y) * smoothstep(1.0, 0.78, vUv.y);
            alpha = xCore * yEnds * fogFactor * uFinOpacity;
          }

          gl_FragColor = vec4(col * alpha, alpha);
        }
      `,
    });
    disposables.push(wallMat);

    const wallMesh = new THREE.Mesh(wallGeo, wallMat);
    wallMesh.frustumCulled = false;
    wallMesh.renderOrder = 2;
    scene.add(wallMesh);

    // =========================================================================
    // 5. HAZE QUAD AT TRUE 0.6x RESOLUTION SCALE
    //    Offscreen WebGLRenderTarget at 0.6x resolution (or max 384x240) rendered
    //    every 4th frame (since the drift cycle is 60s), displayed on 1 camera-facing quad.
    // =========================================================================
    const hazeRT = new THREE.WebGLRenderTarget(384, 240, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      depthBuffer: false,
      stencilBuffer: false,
    });
    disposables.push(hazeRT);

    const hazeOffscreenScene = new THREE.Scene();
    const hazeOffscreenCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const hazeQuadGeo = new THREE.PlaneGeometry(2, 2);
    disposables.push(hazeQuadGeo);

    const hazeNoiseMat = new THREE.ShaderMaterial({
      transparent: false,
      depthWrite: false,
      depthTest: false,
      uniforms: {
        uTime: sharedUniforms.uTime,
        uFogColor: sharedUniforms.uFogColor,
        uHazeOpacity: { value: webgl.hazeOpacity },
        uHazeCycle: { value: webgl.hazeCycleSeconds },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uHazeOpacity;
        uniform float uHazeCycle;
        uniform vec3 uFogColor;
        varying vec2 vUv;

        float hash(vec2 p) {
          p = fract(p * vec2(234.34, 435.345));
          p += dot(p, p + 34.23);
          return fract(p.x * p.y);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
            mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
            f.y
          );
        }

        // 3-octave FBM noise fog in navy-teal
        float fbm3(vec2 p) {
          float v = 0.0;
          v += 0.500 * noise(p); p = p * 2.02 + vec2(17.1, 31.7);
          v += 0.300 * noise(p); p = p * 2.03 + vec2(11.3, 23.5);
          v += 0.200 * noise(p);
          return v;
        }

        void main() {
          float phase = (uTime / uHazeCycle) * 6.2831853;
          vec2 drift = vec2(cos(phase) * 0.45, sin(phase * 0.7) * 0.25);
          float n = fbm3((vUv - 0.5) * vec2(3.2, 2.2) + drift);

          vec2 centered = (vUv - 0.5) * 2.0;
          float radialMask = smoothstep(1.0, 0.18, length(centered * vec2(0.88, 1.08)));

          vec3 navyTeal = vec3(0.32, 0.48, 0.64);
          vec3 col = mix(uFogColor, navyTeal, 0.55);
          float alpha = smoothstep(0.28, 0.85, n) * radialMask * uHazeOpacity;

          gl_FragColor = vec4(col * alpha, alpha);
        }
      `,
    });
    disposables.push(hazeNoiseMat);

    const hazeOffscreenMesh = new THREE.Mesh(hazeQuadGeo, hazeNoiseMat);
    hazeOffscreenScene.add(hazeOffscreenMesh);

    const hazeDisplayMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.NormalBlending,
      uniforms: {
        uHazeTex: { value: hazeRT.texture },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uHazeTex;
        varying vec2 vUv;
        void main() {
          gl_FragColor = texture2D(uHazeTex, vUv);
        }
      `,
    });
    disposables.push(hazeDisplayMat);

    const hazeMesh = new THREE.Mesh(hazeQuadGeo, hazeDisplayMat);
    hazeMesh.frustumCulled = false;
    hazeMesh.renderOrder = 0;
    scene.add(hazeMesh);

    // =========================================================================
    // Camera projection & vanishing-point sync (--vp-x, --vp-y, --floor-y)
    // =========================================================================
    let currentDprCap =
      window.innerWidth > webgl.ultrawideWidthPx
        ? webgl.maxDprUltrawide
        : webgl.maxDpr;

    const updateSizeAndProjection = () => {
      const rect = heroEl.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));

      const targetDpr = Math.min(window.devicePixelRatio || 1, currentDprCap);
      renderer.setPixelRatio(targetDpr);
      renderer.setSize(w, h, false);

      // Update 0.6x haze render target size (clamped to keep fill-rate minimal)
      const rtW = Math.min(480, Math.max(160, Math.round(w * webgl.hazeResolutionScale * 0.5)));
      const rtH = Math.min(300, Math.max(100, Math.round(h * webgl.hazeResolutionScale * 0.5)));
      if (hazeRT.width !== rtW || hazeRT.height !== rtH) {
        hazeRT.setSize(rtW, rtH);
      }

      const cs = getComputedStyle(heroEl);
      const parseCoord = (raw: string, total: number, fallbackFrac: number): number => {
        const s = raw.trim();
        if (s.endsWith("px")) {
          const val = parseFloat(s);
          return Number.isFinite(val) ? val : total * fallbackFrac;
        }
        if (s.endsWith("%")) {
          const val = parseFloat(s);
          return Number.isFinite(val) ? (val / 100) * total : total * fallbackFrac;
        }
        return total * fallbackFrac;
      };

      const vpXPx = parseCoord(cs.getPropertyValue("--vp-x"), w, 0.5);
      const vpYPx = parseCoord(cs.getPropertyValue("--vp-y"), h, 0.5);
      const floorYPx = parseCoord(cs.getPropertyValue("--floor-y"), h, 0.74);

      const floorDeltaPx = Math.max(120, floorYPx - vpYPx);
      sharedUniforms.uFloorY.value = -floorDeltaPx;
      sharedUniforms.uHalfWidth.value = Math.max(840, w * 0.64);
      sharedUniforms.uBarWidth.value = Math.max(1850, w * 1.38);
      sharedUniforms.uFogColor.value.copy(readHeroBgColor());

      const fullW = w * 2;
      const fullH = h * 2;
      const offsetX = w - vpXPx;
      const offsetY = h - vpYPx;
      camera.aspect = fullW / fullH;
      camera.setViewOffset(fullW, fullH, offsetX, offsetY, w, h);
      camera.updateProjectionMatrix();
    };

    updateSizeAndProjection();

    const ro = new ResizeObserver(() => {
      updateSizeAndProjection();
    });
    ro.observe(heroEl);

    // =========================================================================
    // Intro speed ramp (0.15 -> 1.0 over 3.0s, power2.out)
    // =========================================================================
    const speedState = {
      rate: skipIntroRamp ? 1.0 : tunnel.intro.initialPlaybackRate,
    };

    let rampTween: gsap.core.Tween | null = null;
    if (!skipIntroRamp) {
      rampTween = gsap.to(speedState, {
        rate: 1.0,
        duration: tunnel.intro.rampDuration,
        ease: tunnel.intro.rampEase,
      });
    }

    // =========================================================================
    // Render loop, visibility pause/resume, and 3-stage Quality Governor
    // =========================================================================
    let rafId: number | null = null;
    let isDisposed = false;
    let isInViewport = true;
    let isTabVisible = !document.hidden;
    let firstFrameRendered = false;
    let lastTimestamp: number | null = null;
    let frameCounter = 0;

    // Quality governor state (never flip-flops once degraded)
    const frameDeltas: number[] = [];
    let governorStage: 0 | 1 | 2 | 3 = 0;
    let warmupFrames = 20;

    const triggerGracefulFallback = (reason: string) => {
      if (isDisposed || governorStage === 3) return;
      governorStage = 3;
      sessionDegradedToCss = true;
      onFallbackToCss(reason);
    };

    const tick = (now: number) => {
      if (isDisposed) return;

      if (!isInViewport || !isTabVisible) {
        lastTimestamp = null;
        rafId = null;
        return;
      }

      if (lastTimestamp !== null) {
        const rawDtMs = now - lastTimestamp;
        const clampedDtSec = Math.min(0.1, Math.max(0.001, rawDtMs / 1000));

        sharedUniforms.uTime.value += clampedDtSec;
        sharedUniforms.uTravel.value =
          (sharedUniforms.uTravel.value +
            clampedDtSec * baseSpeed * speedState.rate) %
          totalRange;

        // Quality governor measurement (ignore tab switches / > 200ms pauses)
        if (warmupFrames > 0) {
          warmupFrames--;
        } else if (rawDtMs > 0 && rawDtMs < 200) {
          frameDeltas.push(rawDtMs);
          if (frameDeltas.length >= webgl.governor.sampleFrames) {
            const avgMs =
              frameDeltas.reduce((acc, v) => acc + v, 0) / frameDeltas.length;
            frameDeltas.length = 0;

            if (avgMs > webgl.governor.thresholdMs) {
              if (governorStage === 0) {
                // Stage 1: disable haze quad
                governorStage = 1;
                hazeMesh.visible = false;
              } else if (governorStage === 1) {
                // Stage 2: reduce DPR to 1.0
                governorStage = 2;
                currentDprCap = 1.0;
                updateSizeAndProjection();
              } else if (governorStage === 2) {
                // Stage 3: cross-fade back to CSS tunnel and dispose WebGL
                triggerGracefulFallback(
                  `governor-avg-${avgMs.toFixed(1)}ms`
                );
                return;
              }
            }
          }
        }
      }

      lastTimestamp = now;

      // Update offscreen 0.6x haze target on frame 0 and every 4th frame (60s drift cycle needs only ~15 Hz texture update)
      if (hazeMesh.visible && frameCounter % 4 === 0) {
        renderer.setRenderTarget(hazeRT);
        renderer.render(hazeOffscreenScene, hazeOffscreenCam);
        renderer.setRenderTarget(null);
      }
      frameCounter++;

      renderer.render(scene, camera);

      if (!firstFrameRendered) {
        firstFrameRendered = true;
        onReady();
      }

      rafId = window.requestAnimationFrame(tick);
    };

    const syncLoop = () => {
      if (isDisposed) return;
      const shouldRun = isInViewport && isTabVisible;
      if (shouldRun) {
        if (rafId === null) {
          lastTimestamp = null;
          rafId = window.requestAnimationFrame(tick);
        }
      } else if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
        lastTimestamp = null;
      }
    };

    const io = new IntersectionObserver(
      (entries) => {
        isInViewport = Boolean(entries[0]?.isIntersecting);
        syncLoop();
      },
      { threshold: 0.05 }
    );
    io.observe(heroEl);

    const onVisibilityChange = () => {
      isTabVisible = !document.hidden;
      syncLoop();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      triggerGracefulFallback("webglcontextlost");
    };
    const onContextRestored = () => {
      triggerGracefulFallback("webglcontextrestored");
    };
    canvas.addEventListener("webglcontextlost", onContextLost, false);
    canvas.addEventListener("webglcontextrestored", onContextRestored, false);

    const debugHandle = {
      getStage: () => governorStage,
      getHazeVisible: () => hazeMesh.visible,
      getPixelRatio: () => renderer.getPixelRatio(),
      getDrawCalls: () => renderer.info.render.calls,
      getGeometriesCount: () => renderer.info.memory.geometries,
      getTexturesCount: () => renderer.info.memory.textures,
    };
    (
      window as unknown as { __heroTunnelGL?: typeof debugHandle }
    ).__heroTunnelGL = debugHandle;

    syncLoop();

    return () => {
      isDisposed = true;
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
      rampTween?.kill();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      canvas.removeEventListener("webglcontextlost", onContextLost, false);
      canvas.removeEventListener("webglcontextrestored", onContextRestored, false);

      scene.clear();
      hazeOffscreenScene.clear();
      for (const item of disposables) {
        try {
          item.dispose();
        } catch {
          // ignore disposal errors
        }
      }
      try {
        renderer.dispose();
      } catch {
        // ignore
      }
      canvas.remove();
      const win = window as unknown as { __heroTunnelGL?: unknown };
      if (win.__heroTunnelGL === debugHandle) {
        delete win.__heroTunnelGL;
      }
    };
  }, [onReady, onFallbackToCss, skipIntroRamp]);

  return (
    <div
      ref={wrapRef}
      aria-hidden="true"
      data-hero-tunnel-gl-wrap=""
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    />
  );
}
