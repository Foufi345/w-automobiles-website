"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { loadSharedTexture } from "@/lib/sharedRenderer";

interface DistortImageCanvasProps {
  src: string;
  containerRef: React.RefObject<HTMLDivElement | null>;
  isHovered: boolean;
  enableParallax: boolean;
  firstFrameRendered: boolean;
  onFirstFrame: () => void;
  onContextLost: () => void;
  onTimeout: () => void;
}

const TEXTURE_TIMEOUT_MS = 1500;

const VERTEX_SHADER = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;

uniform sampler2D uTexture;
uniform vec2 uMouse;
uniform float uHover;
uniform float uTime;
uniform float uScrollVelocity;
uniform vec2 uResolution;
uniform vec2 uTextureResolution;

varying vec2 vUv;

vec2 getCoverUv(vec2 uv, vec2 screenRes, vec2 texRes) {
  float screenAspect = screenRes.x / screenRes.y;
  float texAspect = texRes.x / texRes.y;
  vec2 ratio = vec2(
    min(screenAspect / texAspect, 1.0),
    min(texAspect / screenAspect, 1.0)
  );
  return (uv - 0.5) * ratio + 0.5;
}

void main() {
  vec2 uv = vUv;

  vec2 mouseDist = uv - uMouse;
  float dist = length(mouseDist);
  float influence = smoothstep(0.65, 0.0, dist) * uHover;
  float ripple = sin(dist * 22.0 - uTime * 4.5) * 0.026 * influence;
  vec2 distortedUv = uv + normalize(mouseDist + 0.0001) * ripple;

  float skew = clamp(uScrollVelocity, -0.04, 0.04);
  distortedUv.y += skew * (distortedUv.x - 0.5);

  vec2 rgbOffset = normalize(mouseDist + 0.0001) * 0.015 * influence;

  vec2 uvR = getCoverUv(distortedUv + rgbOffset, uResolution, uTextureResolution);
  vec2 uvG = getCoverUv(distortedUv, uResolution, uTextureResolution);
  vec2 uvB = getCoverUv(distortedUv - rgbOffset, uResolution, uTextureResolution);

  float r = texture2D(uTexture, uvR).r;
  float g = texture2D(uTexture, uvG).g;
  float b = texture2D(uTexture, uvB).b;

  gl_FragColor = vec4(r, g, b, 1.0);
}
`;

export default function DistortImageCanvas({
  src,
  containerRef,
  isHovered,
  enableParallax,
  firstFrameRendered,
  onFirstFrame,
  onContextLost,
  onTimeout,
}: DistortImageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: false,
        powerPreference: "high-performance",
        depth: false,
        stencil: false,
      });
    } catch {
      return;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    renderer.setPixelRatio(dpr);

    const width = container.clientWidth || 400;
    const height = container.clientHeight || 300;
    renderer.setSize(width, height, false);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const uniforms = {
      uTexture: { value: null as THREE.Texture | null },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uHover: { value: isHovered ? 1 : 0 },
      uTime: { value: 0 },
      uScrollVelocity: { value: 0 },
      uResolution: { value: new THREE.Vector2(width * dpr, height * dpr) },
      uTextureResolution: { value: new THREE.Vector2(1200, 900) },
    };

    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });

    const geometry = new THREE.PlaneGeometry(2, 2);
    const quad = new THREE.Mesh(geometry, material);
    scene.add(quad);

    let isDisposed = false;
    let textureReady = false;
    let hasPaintedFrame = false;

    const timeoutId = window.setTimeout(() => {
      if (!isDisposed && !textureReady) {
        onTimeout();
      }
    }, TEXTURE_TIMEOUT_MS);

    loadSharedTexture(
      src,
      (tex) => {
        if (isDisposed) return;
        window.clearTimeout(timeoutId);
        uniforms.uTexture.value = tex;
        const img = tex.image as { width?: number; height?: number } | undefined;
        if (img) {
          uniforms.uTextureResolution.value.set(
            img.width || 1200,
            img.height || 900
          );
        }
        textureReady = true;
      },
      () => {
        if (isDisposed) return;
        window.clearTimeout(timeoutId);
        onTimeout();
      }
    );

    const startTime = performance.now();
    let animationFrameId = 0;

    const targetMouse = new THREE.Vector2(0.5, 0.5);
    const currentMouse = new THREE.Vector2(0.5, 0.5);
    let targetHover = isHovered ? 1.0 : 0.0;
    let currentHover = isHovered ? 0.3 : 0.0;

    const handlePointerMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const x = (e.clientX - rect.left) / rect.width;
      const y = 1.0 - (e.clientY - rect.top) / rect.height;
      targetMouse.set(x, y);
      targetHover = 1.0;
    };

    let lastScrollY = window.scrollY;
    let scrollVelocity = 0;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const delta = currentScrollY - lastScrollY;
      lastScrollY = currentScrollY;
      scrollVelocity = Math.max(-0.04, Math.min(0.04, delta * 0.002));

      if (enableParallax && container) {
        const rect = container.getBoundingClientRect();
        const parallaxY = (rect.top / window.innerHeight) * -15;
        canvas.style.transform = `translate3d(0, ${parallaxY}px, 0)`;
      }
    };

    container.addEventListener("mousemove", handlePointerMove, { passive: true });
    window.addEventListener("scroll", handleScroll, { passive: true });

    const animate = () => {
      if (isDisposed) return;

      const elapsed = (performance.now() - startTime) * 0.001;
      uniforms.uTime.value = elapsed;

      currentHover += (targetHover - currentHover) * 0.08;
      uniforms.uHover.value = currentHover;

      currentMouse.lerp(targetMouse, 0.08);
      uniforms.uMouse.value.copy(currentMouse);

      scrollVelocity *= 0.92;
      uniforms.uScrollVelocity.value = scrollVelocity;

      if (textureReady && renderer) {
        renderer.render(scene, camera);
        if (!hasPaintedFrame) {
          hasPaintedFrame = true;
          onFirstFrame();
        }
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      cancelAnimationFrame(animationFrameId);
      onContextLost();
    };
    canvas.addEventListener("webglcontextlost", handleContextLost, false);

    return () => {
      isDisposed = true;
      window.clearTimeout(timeoutId);
      cancelAnimationFrame(animationFrameId);
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      container.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("scroll", handleScroll);

      scene.remove(quad);
      geometry.dispose();
      material.dispose();
      renderer?.dispose();
    };
  }, [src, containerRef, enableParallax, isHovered, onFirstFrame, onContextLost, onTimeout]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`absolute inset-0 h-full w-full pointer-events-none transition-opacity duration-300 ${
        firstFrameRendered ? "opacity-100" : "opacity-0"
      }`}
    />
  );
}
