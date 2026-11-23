"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "@/i18n/navigation";
import Lenis from "lenis";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { scheduleScrollRefresh, cancelScrollRefresh } from "@/lib/refreshScroll";

export function SmoothScroll() {
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    // Prevent collapsing mobile address bars from triggering ScrollTrigger refresh loops
    ScrollTrigger.config({ ignoreMobileResize: true });

    let lastWidth = window.innerWidth;

    const handleOrientationOrFonts = () => {
      lastWidth = window.innerWidth;
      lenisRef.current?.resize();
      scheduleScrollRefresh(200);
    };

    // Only refresh on real width changes (ignore height-only mobile address bar resize)
    const handleResize = () => {
      const nextWidth = window.innerWidth;
      if (Math.abs(nextWidth - lastWidth) < 2) return;
      lastWidth = nextWidth;
      lenisRef.current?.resize();
      scheduleScrollRefresh(200);
    };

    window.addEventListener("resize", handleResize, { passive: true });
    window.addEventListener("orientationchange", handleOrientationOrFonts);
    if (document.fonts?.ready) {
      document.fonts.ready.then(handleOrientationOrFonts).catch(() => {});
    }

    // Strict-Mode singleton guard: always destroy any prior Lenis instance first
    const existing = (window as unknown as { __lenis?: Lenis }).__lenis;
    if (existing) {
      existing.destroy();
      (window as unknown as { __lenis?: Lenis }).__lenis = undefined;
    }

    // Native scroll on touch devices & reduced motion: disable Lenis completely
    const isTouchDevice =
      window.matchMedia?.("(pointer: coarse)").matches ||
      "ontouchstart" in window;

    if (prefersReducedMotion || isTouchDevice) {
      lenisRef.current = null;
      return () => {
        window.removeEventListener("resize", handleResize);
        window.removeEventListener("orientationchange", handleOrientationOrFonts);
        cancelScrollRefresh();
      };
    }

    const lenis = new Lenis({
      lerp: 0.1,
      smoothWheel: true,
      syncTouch: false,
    });
    lenisRef.current = lenis;
    (window as unknown as { __lenis?: Lenis }).__lenis = lenis;

    lenis.on("scroll", ScrollTrigger.update);

    const tickerCallback = (time: number) => {
      lenis.raf(time * 1000);
    };

    gsap.ticker.add(tickerCallback);
    gsap.ticker.lagSmoothing(0);

    scheduleScrollRefresh(150);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleOrientationOrFonts);
      cancelScrollRefresh();
      gsap.ticker.remove(tickerCallback);
      lenis.destroy();
      lenisRef.current = null;
      if ((window as unknown as { __lenis?: Lenis }).__lenis === lenis) {
        (window as unknown as { __lenis?: Lenis }).__lenis = undefined;
      }
    };
  }, [prefersReducedMotion]);

  // Resize Lenis & schedule ScrollTrigger refresh on every route change
  useEffect(() => {
    if (typeof window === "undefined") return;
    lenisRef.current?.resize();
    scheduleScrollRefresh(150);
  }, [pathname]);

  return null;
}
