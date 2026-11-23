"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { gsap } from "@/lib/gsap";
import { HERO_MOTION } from "@/lib/hero-motion";

const HeroTunnelGL = dynamic(() => import("@/components/webgl/HeroTunnelGL"), {
  ssr: false,
});

export interface HeroTunnelProps {
  isMobileViewport: boolean;
  reducedMotion: boolean;
  introReady: boolean;
  skipIntroRamp: boolean;
  debugOverlay?: boolean;
}

const WATCHDOG_MS = 4500;

/**
 * Sticky session flag so if the WebGL quality governor ever degrades to CSS,
 * we never re-enable WebGL during the same page session (no flip-flopping).
 */
let sessionForcedCssFallback = false;

/**
 * Strict capability check for the desktop WebGL2 tunnel upgrade.
 * ENABLE ONLY WHEN ALL ARE TRUE:
 * - WebGL2 available
 * - fine pointer ((pointer: fine))
 * - width >= 1024
 * - hardwareConcurrency >= 6
 * - deviceMemory >= 8 (if exposed)
 * - no Save-Data (navigator.connection?.saveData !== true)
 * - no prefers-reduced-motion
 */
function canEnableWebGLTunnel(reducedMotion: boolean): boolean {
  if (typeof window === "undefined") return false;
  if (sessionForcedCssFallback) return false;
  if (reducedMotion) return false;

  const params = new URLSearchParams(window.location.search);
  if (params.get("tunnel") === "css") return false;

  if (
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return false;
  }

  // Allow ?tunnel=webgl to force-test in headless environments if needed, while enforcing all gates by default
  const forceWebglParam = params.get("tunnel") === "webgl";

  if (!forceWebglParam) {
    if (window.innerWidth < 1024) return false;

    const hasFinePointer =
      window.matchMedia?.("(pointer: fine)").matches ?? false;
    if (!hasFinePointer) return false;

    const cores = navigator.hardwareConcurrency ?? 0;
    if (cores < 6) return false;

    const navWithMem = navigator as Navigator & {
      deviceMemory?: number;
      connection?: { saveData?: boolean };
    };
    if (
      typeof navWithMem.deviceMemory === "number" &&
      navWithMem.deviceMemory < 8
    ) {
      return false;
    }

    if (navWithMem.connection?.saveData === true) {
      return false;
    }
  }

  try {
    const testCanvas = document.createElement("canvas");
    const gl2 = testCanvas.getContext("webgl2");
    if (!gl2) return false;
    const loseExt = gl2.getExtension("WEBGL_lose_context");
    loseExt?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/**
 * 3D Animated "Showroom Light Tunnel" Background:
 * - Universal CSS fallback (.hero-tunnel-css-stage): visible by default without JS,
 *   runs a single WAAPI animation on .hero-tunnel-flow.
 * - Capable-Desktop WebGL2 upgrade (<HeroTunnelGL />): loaded via next/dynamic (ssr: false)
 *   inside requestIdleCallback(..., { timeout: 600 }) after first paint.
 * - While WebGL is active, the CSS tunnel WAAPI animation is paused and hidden
 *   (visibility: hidden, opacity: 0) so the page never runs both.
 * - If the 30-frame quality governor (> 22ms) triggers Stage 3, it cross-fades (0.6s)
 *   back to the CSS tunnel and disposes all WebGL resources for the rest of the session.
 */
export function HeroTunnel({
  isMobileViewport,
  reducedMotion,
  introReady,
  skipIntroRamp,
  debugOverlay = false,
}: HeroTunnelProps) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const cssStageRef = useRef<HTMLDivElement | null>(null);
  const glWrapRef = useRef<HTMLDivElement | null>(null);
  const worldRef = useRef<HTMLDivElement | null>(null);
  const flowRef = useRef<HTMLDivElement | null>(null);
  const waapiAnimRef = useRef<Animation | null>(null);

  const [shouldMountGL, setShouldMountGL] = useState(false);
  const [glActive, setGlActive] = useState(false);
  const glActiveRef = useRef(false);

  const { tunnel } = HERO_MOTION;
  const D = tunnel.barSpacing;
  const barCount = isMobileViewport
    ? tunnel.barCount.mobile
    : tunnel.barCount.desktop;
  const loopDurSec = isMobileViewport
    ? tunnel.duration.mobile
    : tunnel.duration.desktop;
  const ceilingBarOp = isMobileViewport
    ? tunnel.opacity.ceilingBarMobile
    : tunnel.opacity.ceilingBarDesktop;
  const {
    perspectivePx,
    ceilingOffsetY,
    sideRailOffsetY,
    barDepthPx,
    glowDepthPx,
    firstBarZ,
  } = tunnel.geometry;

  const barIndices = Array.from({ length: barCount }, (_, i) => i);

  // Schedule lazy WebGL mount after first paint via requestIdleCallback (600ms timeout)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!introReady) return;
    if (!canEnableWebGLTunnel(reducedMotion)) {
      setShouldMountGL(false);
      return;
    }

    let cancelled = false;
    let idleId: number | null = null;
    let timerId: ReturnType<typeof setTimeout> | null = null;

    const activate = () => {
      if (cancelled || sessionForcedCssFallback) return;
      if (canEnableWebGLTunnel(reducedMotion)) {
        setShouldMountGL(true);
      }
    };

    const winWithIdle = window as Window & {
      requestIdleCallback?: (
        cb: () => void,
        opts?: { timeout: number }
      ) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    if (typeof winWithIdle.requestIdleCallback === "function") {
      idleId = winWithIdle.requestIdleCallback(activate, {
        timeout: tunnel.webgl.idleLoadTimeoutMs,
      });
    } else {
      timerId = setTimeout(activate, 120);
    }

    return () => {
      cancelled = true;
      if (
        idleId !== null &&
        typeof winWithIdle.cancelIdleCallback === "function"
      ) {
        winWithIdle.cancelIdleCallback(idleId);
      }
      if (timerId !== null) {
        clearTimeout(timerId);
      }
    };
  }, [introReady, reducedMotion, tunnel.webgl.idleLoadTimeoutMs]);

  // Handoff callback when HeroTunnelGL renders its first frame
  const handleGLReady = useCallback(() => {
    if (sessionForcedCssFallback) return;
    glActiveRef.current = true;
    setGlActive(true);

    const cssEl = cssStageRef.current;
    const glEl = glWrapRef.current;
    const flowEl = flowRef.current;

    if (glEl) {
      gsap.to(glEl, {
        opacity: 1,
        duration: 0.45,
        ease: "power2.out",
      });
    }

    if (cssEl) {
      gsap.to(cssEl, {
        opacity: 0,
        duration: 0.45,
        ease: "power2.out",
        onComplete: () => {
          if (!glActiveRef.current) return;
          cssEl.style.visibility = "hidden";
          // Pause the CSS tunnel WAAPI animation and drop will-change while WebGL owns the background
          if (waapiAnimRef.current?.playState === "running") {
            waapiAnimRef.current.pause();
          }
          if (flowEl) {
            flowEl.style.willChange = "auto";
          }
        },
      });
    }
  }, []);

  // Graceful 0.6s cross-fade fallback when quality governor or context loss triggers
  const handleFallbackToCss = useCallback(
    (_reason: string) => {
      sessionForcedCssFallback = true;
      glActiveRef.current = false;
      setGlActive(false);

      const cssEl = cssStageRef.current;
      const glEl = glWrapRef.current;
      const flowEl = flowRef.current;
      const crossFadeSec = tunnel.webgl.governor.crossFadeSeconds;

      // Resume CSS tunnel immediately before cross-fading in
      if (cssEl) {
        cssEl.style.visibility = "visible";
      }
      if (flowEl && !reducedMotion) {
        flowEl.style.willChange = "transform";
      }
      if (
        waapiAnimRef.current &&
        !reducedMotion &&
        !document.hidden &&
        waapiAnimRef.current.playState !== "running"
      ) {
        waapiAnimRef.current.play();
      }

      if (cssEl) {
        gsap.to(cssEl, {
          opacity: 1,
          duration: crossFadeSec,
          ease: "power2.inOut",
        });
      }

      if (glEl) {
        gsap.to(glEl, {
          opacity: 0,
          duration: crossFadeSec,
          ease: "power2.inOut",
          onComplete: () => {
            // Unmount HeroTunnelGL after cross-fade completes so all WebGL resources are disposed without flash
            setShouldMountGL(false);
          },
        });
      } else {
        setShouldMountGL(false);
      }
    },
    [reducedMotion, tunnel.webgl.governor.crossFadeSeconds]
  );

  // Universal CSS tunnel WAAPI animation + intro speed ramp
  useEffect(() => {
    if (typeof window === "undefined") return;
    const outerEl = outerRef.current;
    const worldEl = worldRef.current;
    const flowEl = flowRef.current;
    if (!outerEl || !worldEl || !flowEl) return;

    if (reducedMotion) {
      gsap.set(outerEl, { opacity: 1 });
      gsap.set(worldEl, { z: 0 });
      gsap.set(flowEl, { z: 0 });
      flowEl.style.willChange = "auto";
      return;
    }

    if (!introReady) return;

    let cancelled = false;
    let isInViewport = true;
    let isTabVisible = !document.hidden;
    let rampTween: gsap.core.Tween | null = null;
    let introTl: gsap.core.Timeline | null = null;
    let watchdogTimer: ReturnType<typeof setTimeout> | null = null;

    flowEl.style.willChange = "transform";

    const waapiAnim = flowEl.animate(
      [
        { transform: "translate3d(0px, 0px, 0px)" },
        { transform: `translate3d(0px, 0px, ${D}px)` },
      ],
      {
        duration: loopDurSec * 1000,
        iterations: Infinity,
        easing: "linear",
      }
    );
    waapiAnimRef.current = waapiAnim;

    const syncPlayState = () => {
      if (cancelled) return;
      // Never run the CSS tunnel animation while WebGL is active
      const shouldRun =
        isInViewport && isTabVisible && !reducedMotion && !glActiveRef.current;
      if (shouldRun) {
        if (waapiAnim.playState !== "running") {
          waapiAnim.play();
        }
      } else {
        if (waapiAnim.playState === "running") {
          waapiAnim.pause();
        }
      }
    };

    const forceFinalTunnelState = () => {
      if (watchdogTimer) {
        clearTimeout(watchdogTimer);
        watchdogTimer = null;
      }
      if (introTl) {
        introTl.kill();
        introTl = null;
      }
      if (rampTween) {
        rampTween.kill();
        rampTween = null;
      }
      gsap.set(outerEl, { opacity: 1 });
      gsap.set(worldEl, { z: 0 });
      waapiAnim.playbackRate = 1;
      syncPlayState();
    };

    if (skipIntroRamp) {
      forceFinalTunnelState();
    } else {
      const rateProxy = { rate: tunnel.intro.initialPlaybackRate };
      waapiAnim.playbackRate = rateProxy.rate;

      gsap.set(outerEl, { opacity: 0 });
      gsap.set(worldEl, { z: tunnel.intro.enterFromZ });
      introTl = gsap.timeline();
      introTl.to(
        outerEl,
        {
          opacity: 1,
          duration: tunnel.intro.fadeInDuration,
          ease: "power2.out",
        },
        0
      );
      introTl.to(
        worldEl,
        {
          z: 0,
          duration: tunnel.intro.fadeInDuration,
          ease: "power2.out",
        },
        0
      );

      rampTween = gsap.to(rateProxy, {
        rate: 1,
        duration: tunnel.intro.rampDuration,
        ease: tunnel.intro.rampEase,
        onUpdate: () => {
          if (!cancelled) {
            waapiAnim.playbackRate = rateProxy.rate;
          }
        },
      });

      watchdogTimer = setTimeout(() => {
        if (!cancelled) {
          forceFinalTunnelState();
        }
      }, WATCHDOG_MS);
    }

    const heroSection = outerEl.closest(".hero-stage") ?? outerEl;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        isInViewport = Boolean(entry?.isIntersecting);
        syncPlayState();
      },
      { threshold: 0.05 }
    );
    observer.observe(heroSection);

    const onVisibilityChange = () => {
      isTabVisible = !document.hidden;
      syncPlayState();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    syncPlayState();

    return () => {
      cancelled = true;
      if (watchdogTimer) {
        clearTimeout(watchdogTimer);
        watchdogTimer = null;
      }
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      introTl?.kill();
      rampTween?.kill();
      waapiAnim.cancel();
      waapiAnimRef.current = null;
      flowEl.style.willChange = "auto";
    };
  }, [
    D,
    loopDurSec,
    reducedMotion,
    introReady,
    skipIntroRamp,
    tunnel.intro.enterFromZ,
    tunnel.intro.fadeInDuration,
    tunnel.intro.initialPlaybackRate,
    tunnel.intro.rampDuration,
    tunnel.intro.rampEase,
  ]);

  return (
    <div
      ref={outerRef}
      aria-hidden="true"
      data-hero-tunnel=""
      data-tunnel-mode={glActive ? "webgl" : "css"}
      className="hero-tunnel-outer pointer-events-none absolute inset-0 z-[1] overflow-hidden select-none"
    >
      {/* 1. UNIVERSAL CSS 3D FALLBACK STAGE (paused & hidden while WebGL is active) */}
      <div
        ref={cssStageRef}
        data-tunnel-css-stage=""
        className="hero-tunnel-perspective absolute inset-0"
        style={{
          perspective: `${perspectivePx}px`,
          perspectiveOrigin: "var(--vp-x, 50%) var(--vp-y, 52%)",
        }}
      >
        <div ref={worldRef} className="hero-tunnel-world absolute inset-0">
          {/* Static Side Rails */}
          <div
            data-tunnel-rail="left"
            className="hero-tunnel-rail hero-tunnel-rail-left"
            style={{
              top: `calc(var(--vp-y, 52%) + ${sideRailOffsetY}px)`,
              opacity: tunnel.opacity.sideRail,
            }}
          />
          <div
            data-tunnel-rail="right"
            className="hero-tunnel-rail hero-tunnel-rail-right"
            style={{
              top: `calc(var(--vp-y, 52%) + ${sideRailOffsetY}px)`,
              opacity: tunnel.opacity.sideRail,
            }}
          />

          {/* Flowing 3D Group: Ceiling Bars + Floor Mirror Bars */}
          <div
            ref={flowRef}
            data-tunnel-flow=""
            className="hero-tunnel-flow absolute inset-0"
          >
            {barIndices.map((i) => {
              const zPx = firstBarZ - i * D;
              const isRed = (i + 1) % tunnel.redEvery === 0;
              const barOpacity = isRed ? tunnel.opacity.redBar : ceilingBarOp;

              return (
                <div
                  key={`c-${i}`}
                  data-tunnel-ceiling-bar={i}
                  className={
                    isRed
                      ? "hero-tunnel-ceiling-bar hero-tunnel-bar-red"
                      : "hero-tunnel-ceiling-bar hero-tunnel-bar-silver"
                  }
                  style={{
                    top: `calc(var(--vp-y, 52%) + ${ceilingOffsetY}px)`,
                    height: `${glowDepthPx}px`,
                    marginTop: `${-glowDepthPx / 2}px`,
                    opacity: barOpacity,
                    transform: `translate3d(-50%, 0px, ${zPx}px) rotateX(52deg)`,
                  }}
                />
              );
            })}

            {barIndices.map((i) => {
              const zPx = firstBarZ - i * D;
              const isRed = (i + 1) % tunnel.redEvery === 0;
              return (
                <div
                  key={`f-${i}`}
                  data-tunnel-floor-bar={i}
                  className={
                    isRed
                      ? "hero-tunnel-floor-bar hero-tunnel-floor-red"
                      : "hero-tunnel-floor-bar hero-tunnel-floor-silver"
                  }
                  style={{
                    top: "var(--floor-y, 74%)",
                    height: `${barDepthPx * 2.2}px`,
                    marginTop: `${-(barDepthPx * 2.2) / 2}px`,
                    opacity: Number(
                      (
                        tunnel.opacity.floorMirrorBar *
                        Math.min(1, (i + 0.5) / 2.2)
                      ).toFixed(3)
                    ),
                    transform: `translate3d(-50%, 0px, ${zPx}px) rotateX(-52deg)`,
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. CAPABLE-DESKTOP WEBGL2 STAGE (lazy-loaded after first paint via requestIdleCallback) */}
      {shouldMountGL && (
        <div
          ref={glWrapRef}
          data-tunnel-gl-stage=""
          className="pointer-events-none absolute inset-0"
          style={{ opacity: 0 }}
        >
          <HeroTunnelGL
            onReady={handleGLReady}
            onFallbackToCss={handleFallbackToCss}
            skipIntroRamp={skipIntroRamp}
          />
        </div>
      )}

      {/* 3. SHARED STATIC FOG, VIGNETTE & TEXT-DIMMING OVERLAY: hides far convergence at (--vp-x, --vp-y) + dims H1/CTA zones to <=35% + dissolves top/bottom into var(--hero-bg) */}
      <div className="hero-tunnel-fog absolute inset-0 z-[2]" />

      {/* Debug markers for --vp-y and --floor-y when ?debug=1 */}
      {debugOverlay && (
        <div className="pointer-events-none absolute inset-0 z-30">
          <div
            style={{ top: "var(--vp-y, 52%)", left: "50%" }}
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-fuchsia-400 bg-fuchsia-500/40 px-2 py-0.5 text-[9px] font-mono text-fuchsia-200"
          >
            VP (--vp-x, --vp-y) [{glActive ? "WebGL2" : "CSS"}]
          </div>
          <div
            style={{ top: "var(--floor-y, 74%)" }}
            className="absolute inset-x-0 border-t border-dotted border-fuchsia-400/80"
          >
            <span className="bg-black/80 px-1 text-[9px] font-mono text-fuchsia-300">
              tunnel --floor-y
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
