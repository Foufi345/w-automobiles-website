"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useIntro } from "@/lib/intro";

interface HeroCanvasProps {
  onScrollProgress?: (progress: number) => void;
}

const VERTEX_SHADER = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;

uniform float uTime;
uniform vec2 uMouse;
uniform float uScroll;
uniform vec2 uResolution;
uniform float uLightSweep;
uniform float uDir;
uniform bool uIsMobile;

varying vec2 vUv;

// 2D Simplex Noise
vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }

float snoise(vec2 v) {
  const vec4 C = vec4(
    0.211324865405187,
    0.366025403784439,
    -0.577350269189626,
    0.024390243902439
  );
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

// Fractional Brownian Motion (2 octaves on mobile for 50% GPU saving, 4 octaves on desktop)
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  vec2 shift = vec2(100.0);
  mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
  int maxOctaves = uIsMobile ? 2 : 4;
  for (int i = 0; i < 4; ++i) {
    if (i >= maxOctaves) break;
    v += a * snoise(p);
    p = rot * p * 2.0 + shift;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 st = gl_FragCoord.xy / uResolution.xy;
  float aspect = uResolution.x / uResolution.y;
  vec2 p = st;
  p.x *= aspect;

  float t = uTime * 0.12;
  vec2 m = uMouse;
  m.x *= aspect;

  // Soft cursor ripple / illumination
  float distToMouse = length(p - m);
  float mouseEffect = smoothstep(0.85, 0.0, distToMouse);

  // Domain warping for dark liquid silk texture
  vec2 q = vec2(
    fbm(p + vec2(0.0, t * 0.5)),
    fbm(p + vec2(5.2, 1.3 - t * 0.4))
  );

  vec2 r = vec2(
    fbm(p + 4.0 * q + vec2(1.7, 9.2) + 0.18 * mouseEffect),
    fbm(p + 4.0 * q + vec2(8.3, 2.8) + t * 0.3)
  );

  float f = fbm(p + 3.0 * r);

  // Brand Palette:
  // Base: #0B121A (11, 18, 26)
  // Mid: #111C27 (17, 28, 39)
  // Highlights: #1E2E3E (30, 46, 62)
  // Accent Red: #C8102E (200, 16, 46)
  vec3 cBase = vec3(0.043, 0.070, 0.102);
  vec3 cMid = vec3(0.067, 0.110, 0.153);
  vec3 cHighlight = vec3(0.118, 0.180, 0.243);
  vec3 cRed = vec3(0.784, 0.063, 0.180);

  // Blending the liquid silk folds
  vec3 color = mix(cBase, cMid, clamp((f * f) * 3.4, 0.0, 1.0));
  color = mix(color, cHighlight, clamp(length(q), 0.0, 1.0) * 0.65);

  // Specular cursor glow
  color += cHighlight * mouseEffect * 0.35;

  // Very sparse thin streaks of #C8102E (at most 3% to 5% of the surface)
  float ridge = abs(fbm(p * 2.6 + r * 1.8 + t * 0.2));
  float redMask = smoothstep(0.73, 0.79, ridge);
  redMask *= smoothstep(0.35, 0.75, q.x);
  color = mix(color, cRed, redMask * 0.82);

  // Subtle volumetric light sweep when hero becomes visible (mirrors with uDir in RTL)
  if (uLightSweep > -0.5 && uLightSweep < 1.6) {
    float sweepX = uDir > 0.0 ? st.x : (1.0 - st.x);
    float sweepDist = abs((sweepX + st.y * 0.45) - uLightSweep);
    float sweep = smoothstep(0.38, 0.0, sweepDist);
    color += cHighlight * sweep * 0.45;
    color += cRed * sweep * redMask * 0.35;
  }

  // Scroll vignette and darkening
  vec2 uvVignette = st * (1.0 - st.yx);
  float vig = uvVignette.x * uvVignette.y * 15.0;
  vig = clamp(pow(vig, 0.25), 0.0, 1.0);
  color *= mix(1.0, vig, 0.42 + uScroll * 0.5);
  color = mix(color, cBase, clamp(uScroll * 0.65, 0.0, 0.88));

  gl_FragColor = vec4(color, 1.0);
}
`;

export default function HeroCanvas({ onScrollProgress }: HeroCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isReady, setIsReady] = useState(false);

  const { state: introState } = useIntro();
  const introDoneRef = useRef(introState === "done");
  introDoneRef.current = introState === "done";

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof window === "undefined") return;

    let isDisposed = false;
    let cleanupFn: (() => void) | undefined;
    setIsReady(false);

    const initCanvas = () => {
      if (isDisposed || !containerRef.current) return;

      const isMobile =
        /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
        window.innerWidth < 768;

      let renderer: THREE.WebGLRenderer | null = null;
      try {
        renderer = new THREE.WebGLRenderer({
          antialias: false,
          powerPreference: "high-performance",
          alpha: true,
          depth: false,
          stencil: false,
        });
      } catch {
        return;
      }

      const dpr = isMobile ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
      renderer.setPixelRatio(dpr);
      // Clear to brand navy (never black)
      renderer.setClearColor(0x0b121a, 0);

      const width = container.clientWidth || window.innerWidth;
      const height = container.clientHeight || window.innerHeight;
      renderer.setSize(width, height);
      renderer.domElement.className = "w-full h-full block";
      container.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

      const isRtl = document.documentElement.dir === "rtl";

      // Deterministic uniform defaults — identical on first load and on revisit
      const uniforms = {
        uTime: { value: 0 },
        uMouse: { value: new THREE.Vector2(0.5, 0.5) },
        uScroll: { value: 0 },
        uResolution: { value: new THREE.Vector2(width * dpr, height * dpr) },
        uLightSweep: { value: -0.5 },
        uDir: { value: isRtl ? -1.0 : 1.0 },
        uIsMobile: { value: isMobile },
      };

      const material = new THREE.ShaderMaterial({
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        uniforms,
        depthTest: false,
        depthWrite: false,
      });

      const geometry = new THREE.PlaneGeometry(2, 2);
      const quad = new THREE.Mesh(geometry, material);
      scene.add(quad);

      let elapsedSec = 0;
      let lastFrameTime = performance.now();
      let animationFrameId = 0;
      let isVisible = true;
      let hasPaintedFirstFrame = false;

      // Pointer tracking (lerped)
      const targetMouse = new THREE.Vector2(0.5, 0.5);
      const currentMouse = new THREE.Vector2(0.5, 0.5);

      const handlePointerMove = (e: MouseEvent) => {
        const rect = container.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        const x = (e.clientX - rect.left) / rect.width;
        const y = 1.0 - (e.clientY - rect.top) / rect.height;
        targetMouse.set(
          Math.max(0.0, Math.min(1.0, x)),
          Math.max(0.0, Math.min(1.0, y))
        );
      };

      let lastScrollY = window.scrollY;
      let scrollVelocity = 0;

      const handleScroll = () => {
        const currentScrollY = window.scrollY;
        const delta = Math.abs(currentScrollY - lastScrollY);
        lastScrollY = currentScrollY;
        scrollVelocity = Math.min(1.0, scrollVelocity + delta * 0.02);

        const heroHeight = container.clientHeight || 800;
        const progress = Math.max(0.0, Math.min(1.0, currentScrollY / heroHeight));
        uniforms.uScroll.value = progress;
        if (onScrollProgress) {
          onScrollProgress(progress);
        }
      };

      if (!isMobile) {
        window.addEventListener("pointermove", handlePointerMove, { passive: true });
      }
      window.addEventListener("scroll", handleScroll, { passive: true });

      // Volumetric light sweep starts only once intro is "done" so first load == revisit
      let lightSweepStart: number | null = null;
      const sweepDuration = 1800;

      const animate = () => {
        if (isDisposed || !isVisible) return;

        const now = performance.now();
        elapsedSec += Math.min(0.1, (now - lastFrameTime) * 0.001);
        lastFrameTime = now;
        uniforms.uTime.value = elapsedSec;

        currentMouse.lerp(targetMouse, 0.045);
        uniforms.uMouse.value.copy(currentMouse);

        if (introDoneRef.current) {
          if (lightSweepStart === null) {
            lightSweepStart = performance.now();
          }
          const sweepProgress = (performance.now() - lightSweepStart) / sweepDuration;
          if (sweepProgress <= 1.0) {
            uniforms.uLightSweep.value = -0.5 + sweepProgress * 2.1;
          } else {
            uniforms.uLightSweep.value = 2.0;
          }
        }

        if (scrollVelocity > 0.001) {
          scrollVelocity *= 0.94;
        }

        renderer?.render(scene, camera);

        if (!hasPaintedFirstFrame) {
          hasPaintedFirstFrame = true;
          setIsReady(true);
        }

        animationFrameId = requestAnimationFrame(animate);
      };

      let isTabVisible = !document.hidden;

      const syncLoopState = () => {
        if (isDisposed) return;
        if (isVisible && isTabVisible) {
          lastFrameTime = performance.now();
          cancelAnimationFrame(animationFrameId);
          animationFrameId = requestAnimationFrame(animate);
        } else {
          cancelAnimationFrame(animationFrameId);
        }
      };

      const observer = new IntersectionObserver(
        (entries) => {
          const [entry] = entries;
          const nowVisible = entry.isIntersecting;
          if (nowVisible !== isVisible) {
            isVisible = nowVisible;
            syncLoopState();
          }
        },
        { threshold: 0.05 }
      );
      observer.observe(container);

      const handleVisibilityChange = () => {
        isTabVisible = !document.hidden;
        syncLoopState();
      };
      document.addEventListener("visibilitychange", handleVisibilityChange);

      const handleResize = () => {
        if (!container || !renderer) return;
        const w = container.clientWidth || window.innerWidth;
        const h = container.clientHeight || window.innerHeight;
        renderer.setSize(w, h);
        uniforms.uResolution.value.set(w * dpr, h * dpr);
      };
      window.addEventListener("resize", handleResize);

      handleScroll();
      animate();

      cleanupFn = () => {
        cancelAnimationFrame(animationFrameId);
        observer.disconnect();
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("scroll", handleScroll);
        window.removeEventListener("resize", handleResize);

        scene.remove(quad);
        geometry.dispose();
        material.dispose();

        if (renderer) {
          renderer.dispose();
          renderer.forceContextLoss();
          if (renderer.domElement && renderer.domElement.parentNode) {
            renderer.domElement.parentNode.removeChild(renderer.domElement);
          }
          renderer = null;
        }
      };
    };

    // Delay canvas initialization until after first paint (requestIdleCallback with 500ms timeout fallback)
    const win = window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    if (typeof win.requestIdleCallback === "function") {
      const idleId = win.requestIdleCallback(initCanvas, { timeout: 500 });
      return () => {
        isDisposed = true;
        win.cancelIdleCallback?.(idleId);
        cleanupFn?.();
      };
    } else {
      const timeoutId = window.setTimeout(initCanvas, 60);
      return () => {
        isDisposed = true;
        window.clearTimeout(timeoutId);
        cleanupFn?.();
      };
    }
  }, [onScrollProgress]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={`absolute inset-0 pointer-events-none overflow-hidden transition-opacity duration-700 ease-out ${
        isReady ? "opacity-100" : "opacity-0"
      }`}
    />
  );
}
