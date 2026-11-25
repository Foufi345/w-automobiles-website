"use client";

import { useEffect, useRef } from "react";
import { ScrollTrigger } from "@/lib/gsap";
import { HERO3D_CONFIG } from "@/lib/hero3d-config";
import {
  HeroScene,
  type FramingZoneRects,
} from "@/lib/hero3d/HeroScene";
import { resolveHeroArrivalSession } from "@/lib/hero3d/session-state";
import { getTransitionSnapshot, subscribeTransition } from "@/lib/transition";

export interface Hero3DCanvasProps {
  posterMode: boolean;
  locale: string;
  measureZones: () => FramingZoneRects;
  onSceneReady: (scene: HeroScene) => void;
  onFallbackToPoster: (reason: string) => void;
  onTextRevealChange: (mode: "hidden" | "reveal" | "instant") => void;
}

/**
 * Dynamically imported Three.js Canvas Host (`ssr: false`):
 * - Strict Mode safe: leaves exactly one `<canvas>` and one WebGL context.
 * - Waits for both the GLB and `document.fonts.ready` within the 6 s budget
 *   so `computeFraming()` measures the exact final font metrics before first render.
 * - Recomputes framing on resize via a `100 ms` debounced `ResizeObserver` and
 *   immediately renders a single frame.
 */
export default function Hero3DCanvas({
  posterMode,
  locale,
  measureZones,
  onSceneReady,
  onFallbackToPoster,
  onTextRevealChange,
}: Hero3DCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<HeroScene | null>(null);

  useEffect(() => {
    const containerEl = containerRef.current;
    const sectionEl = containerEl?.closest("section") as HTMLElement | null;
    if (!containerEl || !sectionEl) return;

    const mountStartMs = performance.now();
    const urlParams = new URLSearchParams(window.location.search);
    const resolvedPosterMode = posterMode || urlParams.get("poster") === "1";
    const totalBudgetMs = resolvedPosterMode
      ? 60000
      : HERO3D_CONFIG.loading.timeoutMs;

    const heroScene = new HeroScene(containerEl, measureZones(), {
      config: HERO3D_CONFIG,
      posterMode: resolvedPosterMode,
      onFallbackToPoster,
      onTextRevealChange,
    });
    sceneRef.current = heroScene;

    let cancelled = false;
    const watchdog = window.setTimeout(() => {
      if (!cancelled && !sceneRef.current?.getFramingTelemetry()?.triangles) {
        cancelled = true;
        heroScene.dispose();
        sceneRef.current = null;
        onFallbackToPoster("6s-watchdog-timeout");
      }
    }, totalBudgetMs);

    const fontsPromise =
      typeof document !== "undefined" && document.fonts?.ready
        ? Promise.race([
            document.fonts.ready,
            new Promise<void>((r) => setTimeout(r, 1200)),
          ]).catch(() => {})
        : Promise.resolve();

    const remainingMs = Math.max(
      500,
      totalBudgetMs - (performance.now() - mountStartMs)
    );

    let unsubTransition: (() => void) | null = null;
    let transitionFallbackTimer: ReturnType<typeof setTimeout> | null = null;

    Promise.all([heroScene.loadCarModel(remainingMs), fontsPromise]).then(
      ([loadedOk]) => {
        window.clearTimeout(watchdog);
        if (cancelled || !loadedOk) return;

        const session = resolveHeroArrivalSession(heroScene.getDurationSec(), {
          posterMode: resolvedPosterMode,
        });

        heroScene.computeFraming(measureZones(), false);

        const beginPlayback = () => {
          if (cancelled) return;
          if (session.mode === "poster-capture") {
            heroScene.setScrubTime(session.initialTimeSec);
          } else if (session.mode === "parked-return") {
            heroScene.jumpToParkedAndStop(true);
          } else {
            heroScene.startArrival(session.initialTimeSec);
          }
          onSceneReady(heroScene);
          ScrollTrigger.refresh();
        };

        // If arriving via PageTransition cover (e.g. clicking Home from /vehicules),
        // wait until the transition cover finishes revealing so t = 0 is never hidden behind it.
        if (
          session.mode === "play-once" &&
          getTransitionSnapshot().state !== "idle"
        ) {
          heroScene.applyState(0);
          heroScene.renderSingleFrame();
          let started = false;
          const runOnce = () => {
            if (started) return;
            started = true;
            if (unsubTransition) {
              unsubTransition();
              unsubTransition = null;
            }
            if (transitionFallbackTimer) {
              clearTimeout(transitionFallbackTimer);
              transitionFallbackTimer = null;
            }
            beginPlayback();
          };
          unsubTransition = subscribeTransition(() => {
            if (getTransitionSnapshot().state === "idle") {
              runOnce();
            }
          });
          transitionFallbackTimer = setTimeout(runOnce, 700);
        } else {
          beginPlayback();
        }
      }
    );

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const handleResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (cancelled || !sceneRef.current) return;
        sceneRef.current.computeFraming(measureZones(), true);
      }, HERO3D_CONFIG.framing.resizeDebounceMs);
    };

    const ro = new ResizeObserver(handleResize);
    ro.observe(sectionEl);
    const topZone = sectionEl.querySelector("[data-hero-h1]");
    const botZone = sectionEl.querySelector("[data-hero-bottom-zone]");
    if (topZone) ro.observe(topZone);
    if (botZone) ro.observe(botZone);
    window.addEventListener("resize", handleResize, { passive: true });

    const win = window as unknown as { __HERO_POSTER_READY__?: boolean };

    return () => {
      cancelled = true;
      window.clearTimeout(watchdog);
      if (unsubTransition) unsubTransition();
      if (transitionFallbackTimer) clearTimeout(transitionFallbackTimer);
      if (resizeTimer) clearTimeout(resizeTimer);
      ro.disconnect();
      window.removeEventListener("resize", handleResize);
      heroScene.dispose();
      sceneRef.current = null;
      delete win.__HERO_POSTER_READY__;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posterMode]);

  useEffect(() => {
    if (!sceneRef.current) return;
    const recompute = () => {
      sceneRef.current?.computeFraming(measureZones(), true);
    };
    recompute();
    if (typeof document !== "undefined" && document.fonts?.ready) {
      document.fonts.ready.then(recompute).catch(() => {});
    }
  }, [locale, measureZones]);

  return (
    <div
      ref={containerRef}
      dir="ltr"
      aria-hidden="true"
      data-hero3d-canvas-host=""
      className="pointer-events-none h-full w-full"
    />
  );
}
