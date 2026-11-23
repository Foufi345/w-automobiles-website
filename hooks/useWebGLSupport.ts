"use client";

import { useEffect, useState } from "react";

export interface WebGLSupportInfo {
  hasWebGL2: boolean;
  isLowEnd: boolean;
  isMobile: boolean;
  canRender3D: boolean;
}

/**
 * Hook to detect WebGL2 capability, device performance tier (concurrency, memory),
 * and mobile form factor. Prevents loading heavy 3D canvases on low-power devices.
 */
export function useWebGLSupport(): WebGLSupportInfo {
  const [info, setInfo] = useState<WebGLSupportInfo>({
    hasWebGL2: false,
    isLowEnd: false,
    isMobile: false,
    canRender3D: false,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Detect WebGL2
    let hasWebGL2 = false;
    try {
      const canvas = document.createElement("canvas");
      hasWebGL2 = !!(
        window.WebGL2RenderingContext && canvas.getContext("webgl2")
      );
    } catch {
      hasWebGL2 = false;
    }

    // 2. Detect low-end hardware (<= 4 cores, <= 4GB RAM, or Save-Data enabled)
    const nav = navigator as Navigator & {
      deviceMemory?: number;
      connection?: { saveData?: boolean };
    };
    const cores = nav.hardwareConcurrency || 4;
    const memory = nav.deviceMemory || 8;
    const saveData = Boolean(nav.connection?.saveData);
    const isLowEnd = cores <= 4 || memory <= 4 || saveData;

    // 3. Detect mobile device
    const isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      ) ||
      (window.matchMedia && window.matchMedia("(max-width: 768px)").matches);

    // 4. canRender3D: WebGL2 must be available and device shouldn't be underpowered
    const canRender3D = hasWebGL2 && !isLowEnd;

    setInfo({
      hasWebGL2,
      isLowEnd,
      isMobile,
      canRender3D,
    });
  }, []);

  return info;
}
