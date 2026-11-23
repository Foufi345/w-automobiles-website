"use client";

import * as THREE from "three";

let sharedRenderer: THREE.WebGLRenderer | null = null;
const textureCache = new Map<string, THREE.Texture>();
let textureLoader: THREE.TextureLoader | null = null;

/**
 * Returns a singleton WebGLRenderer to strictly prevent mobile GPU crashes
 * caused by multiple active WebGL contexts.
 */
export function getSharedRenderer(): THREE.WebGLRenderer | null {
  if (typeof window === "undefined") return null;

  if (!sharedRenderer) {
    try {
      sharedRenderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: false,
        powerPreference: "high-performance",
        depth: false,
        stencil: false,
      });
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      sharedRenderer.setPixelRatio(dpr);
    } catch {
      sharedRenderer = null;
    }
  }

  return sharedRenderer;
}

/**
 * Loads and caches textures with CORS (`anonymous`) so cross-origin Cloudinary
 * images work safely in WebGL, calling `onError` on failure for clean <img> fallback.
 */
export function loadSharedTexture(
  url: string,
  onLoad?: (texture: THREE.Texture) => void,
  onError?: () => void
): THREE.Texture | null {
  if (typeof window === "undefined") return null;

  if (!textureLoader) {
    textureLoader = new THREE.TextureLoader();
    textureLoader.setCrossOrigin("anonymous");
  }

  if (textureCache.has(url)) {
    const cached = textureCache.get(url)!;
    if (onLoad && cached.image) onLoad(cached);
    return cached;
  }

  const texture = textureLoader.load(
    url,
    (loaded) => {
      loaded.generateMipmaps = false;
      loaded.minFilter = THREE.LinearFilter;
      loaded.magFilter = THREE.LinearFilter;
      if (onLoad) onLoad(loaded);
    },
    undefined,
    () => {
      // Remove failed entry so future retries aren't stuck, and notify caller to fall back to <img>
      textureCache.delete(url);
      if (onError) onError();
    }
  );

  textureCache.set(url, texture);
  return texture;
}
