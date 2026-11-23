"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import {
  useIntro,
  lockLenis,
  startExitingIntro,
  completeIntro,
} from "@/lib/intro";

const WORDMARK = "W AUTOMOBILES";
const HARD_CAP_MS = 950;
const HERO_TEXTURE_SRC = "/images/showroom-hero.jpg";

export function Preloader() {
  const tCommon = useTranslations("common");
  const { state } = useIntro();
  const reducedMotion = useReducedMotion();
  const [percent, setPercent] = useState(0);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const topPanelRef = useRef<HTMLDivElement | null>(null);
  const bottomPanelRef = useRef<HTMLDivElement | null>(null);
  const centerWrapRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLDivElement | null>(null);
  const lineRef = useRef<HTMLDivElement | null>(null);

  const progressObjRef = useRef({ value: 0 });
  const exitTimelineRef = useRef<gsap.core.Timeline | null>(null);
  const progressTweenRef = useRef<gsap.core.Tween | null>(null);

  // If reduced motion becomes true at any point, immediately finish
  useEffect(() => {
    if (reducedMotion && state !== "done") {
      completeIntro();
    }
  }, [reducedMotion, state]);

  // Unified, idempotent exit path (used by completion, 2s hard cap, and Skip button)
  const triggerExit = useCallback((skipped = false) => {
    // Transition orchestrator to "exiting" (no-op if already exiting or done)
    startExitingIntro(skipped);
  }, []);

  // Lock Lenis while preloader is loading
  useEffect(() => {
    if (state === "loading") {
      lockLenis();
    }
  }, [state]);

  // 1. Entrance animation + weighted real progress + minimum creep + 2.0s hard cap
  useGSAP(
    () => {
      if (state !== "loading" || reducedMotion) return;

      let cancelled = false;
      progressObjRef.current.value = 0;
      setPercent(0);

      // Letters stagger reveal & brand red line draw
      const letterEls = textRef.current?.querySelectorAll(".preloader-char");
      if (letterEls && letterEls.length > 0) {
        gsap.fromTo(
          letterEls,
          { opacity: 0, y: 12 },
          {
            opacity: 1,
            y: 0,
            duration: 0.45,
            stagger: 0.035,
            ease: "power3.out",
          }
        );
      }

      if (lineRef.current) {
        gsap.fromTo(
          lineRef.current,
          { scaleX: 0 },
          { scaleX: 1, duration: 1.0, ease: "power2.inOut" }
        );
      }

      // Real weighted progress:
      // fonts (30%) + hero texture decode (40%) + critical images/document load (30%)
      let fontsWeight = 0;
      let heroTexWeight = 0;
      let criticalWeight = 0;
      let creepFloor = 10;
      let currentTarget = 0;
      let exitTriggered = false;

      const finishToExit = () => {
        if (cancelled || exitTriggered) return;
        exitTriggered = true;
        window.clearInterval(creepInterval);
        triggerExit(false);
      };

      const animateToTarget = (duration = 0.28) => {
        if (cancelled || exitTriggered) return;
        const realTotal = fontsWeight + heroTexWeight + criticalWeight;
        const nextTarget = Math.min(100, Math.max(realTotal, creepFloor));

        // Never restart/kill a tween already heading to >= nextTarget
        if (nextTarget <= currentTarget && progressTweenRef.current?.isActive()) {
          return;
        }
        currentTarget = nextTarget;

        if (realTotal >= 100) {
          window.clearInterval(creepInterval);
        }

        progressTweenRef.current?.kill();
        progressTweenRef.current = gsap.to(progressObjRef.current, {
          value: nextTarget,
          duration: realTotal >= 100 ? 0.25 : duration,
          ease: "power2.out",
          overwrite: true,
          onUpdate: () => {
            if (!cancelled) {
              setPercent(Math.round(progressObjRef.current.value));
            }
          },
          onComplete: () => {
            if (!cancelled && (fontsWeight + heroTexWeight + criticalWeight) >= 100) {
              setPercent(100);
              finishToExit();
            }
          },
        });
      };

      // Minimum creeping speed so counter always moves and never stalls
      const creepInterval = window.setInterval(() => {
        if (cancelled || exitTriggered) return;
        if (fontsWeight + heroTexWeight + criticalWeight >= 100) {
          window.clearInterval(creepInterval);
          return;
        }
        creepFloor = Math.min(92, creepFloor + 6);
        animateToTarget(0.22);
      }, 220);
      animateToTarget(0.25);

      // Weight 1: Fonts (30%)
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready
          .then(() => {
            if (cancelled) return;
            fontsWeight = 30;
            animateToTarget(0.3);
          })
          .catch(() => {
            if (cancelled) return;
            fontsWeight = 30;
            animateToTarget(0.3);
          });
      } else {
        fontsWeight = 30;
        animateToTarget(0.3);
      }

      // Weight 2: Hero texture decode (40%)
      const heroImg = new window.Image();
      heroImg.src = HERO_TEXTURE_SRC;
      const markHeroDecoded = () => {
        if (cancelled) return;
        heroTexWeight = 40;
        animateToTarget(0.3);
      };
      if (typeof heroImg.decode === "function") {
        heroImg.decode().then(markHeroDecoded).catch(markHeroDecoded);
      } else {
        heroImg.onload = markHeroDecoded;
        heroImg.onerror = markHeroDecoded;
      }

      // Weight 3: Critical images / document load (30%)
      const markCriticalDone = () => {
        if (cancelled) return;
        criticalWeight = 30;
        animateToTarget(0.3);
      };

      const handleLoad = () => markCriticalDone();
      if (document.readyState === "complete") {
        markCriticalDone();
      } else {
        window.addEventListener("load", handleLoad, { once: true });
      }

      // Hard cap: 2.0s total regardless of what is still loading
      const hardCapTimer = window.setTimeout(() => {
        if (cancelled) return;
        fontsWeight = 30;
        heroTexWeight = 40;
        criticalWeight = 30;
        progressObjRef.current.value = 100;
        setPercent(100);
        triggerExit(false);
      }, HARD_CAP_MS);

      return () => {
        cancelled = true;
        window.clearInterval(creepInterval);
        window.clearTimeout(hardCapTimer);
        window.removeEventListener("load", handleLoad);
        progressTweenRef.current?.kill();
        progressTweenRef.current = null;
      };
    },
    { scope: containerRef, dependencies: [state, reducedMotion, triggerExit] }
  );

  // 2. Exit animation when state transitions to "exiting"
  useGSAP(
    () => {
      if (state !== "exiting") return;

      // Kill any running progress tween immediately
      progressTweenRef.current?.kill();
      progressTweenRef.current = null;

      // Immediately make preloader non-interactive
      if (containerRef.current) {
        gsap.set(containerRef.current, { pointerEvents: "none" });
      }

      const centerWrap = centerWrapRef.current;
      const topPanel = topPanelRef.current;
      const bottomPanel = bottomPanelRef.current;

      exitTimelineRef.current?.kill();
      const tl = gsap.timeline({
        onComplete: () => {
          // Resolves "done" state, unlocks Lenis, and unmounts Preloader (including Skip button)
          completeIntro();
        },
      });
      exitTimelineRef.current = tl;

      // Fade out ENTIRE center wrapper (wordmark, red line, counter, AND "Passer l'introduction" button)
      if (centerWrap) {
        tl.to(centerWrap, {
          opacity: 0,
          scale: 0.96,
          duration: 0.18,
          ease: "power2.in",
        });
      }

      // Split and slide panels away
      if (topPanel && bottomPanel) {
        tl.to(
          topPanel,
          {
            yPercent: -100,
            duration: 0.38,
            ease: "power3.inOut",
          },
          "-=0.1"
        );
        tl.to(
          bottomPanel,
          {
            yPercent: 100,
            duration: 0.38,
            ease: "power3.inOut",
          },
          "<"
        );
      }

      return () => {
        tl.kill();
        exitTimelineRef.current = null;
      };
    },
    { scope: containerRef, dependencies: [state] }
  );

  // Only render during "loading" or "exiting"; unmounted in "idle" or "done" or reducedMotion
  if (reducedMotion || (state !== "loading" && state !== "exiting")) {
    return null;
  }

  const isExiting = state === "exiting";

  return (
    <div
      ref={containerRef}
      role="status"
      aria-live="polite"
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center select-none ${
        isExiting ? "pointer-events-none" : "pointer-events-auto"
      }`}
    >
      {/* Top Split Panel */}
      <div
        ref={topPanelRef}
        className="absolute inset-x-0 top-0 h-[50.5svh] bg-navy-950 border-b border-navy-700/40 will-change-transform"
      />

      {/* Bottom Split Panel */}
      <div
        ref={bottomPanelRef}
        className="absolute inset-x-0 bottom-0 h-[50.5svh] bg-navy-950 border-t border-navy-700/40 will-change-transform"
      />

      {/* Center Content Wrapper (Wordmark, Line, Counter, AND Skip Button — all fade out together) */}
      <div
        ref={centerWrapRef}
        className="relative z-10 flex flex-col items-center justify-center px-6 text-center"
      >
        <div
          ref={textRef}
          dir="ltr"
          className="wordmark text-2xl sm:text-3xl md:text-4xl font-semibold text-ivory"
        >
          {WORDMARK.split("").map((char, index) => (
            <span
              key={`${char}-${index}`}
              className="preloader-char inline-block"
              style={{ minWidth: char === " " ? "0.45em" : undefined }}
            >
              {char}
            </span>
          ))}
        </div>

        <div
          ref={lineRef}
          className="mt-4 h-[2px] w-48 sm:w-64 bg-brand-red rounded-full origin-center"
        />

        <p className="mt-3 font-mono text-xs tracking-widest text-silver">
          {percent}%
        </p>

        <button
          type="button"
          onClick={() => triggerExit(true)}
          disabled={isExiting}
          className="mt-6 rounded-full border border-navy-700/70 bg-navy-900/60 px-4 py-1.5 text-[11px] uppercase tracking-wider text-silver backdrop-blur-sm transition-colors hover:border-silver/40 hover:text-ivory"
        >
          {tCommon("skipIntro")}{" "}
          <span aria-hidden="true" className="inline-block rtl:rotate-180">
            &rarr;
          </span>
        </button>
      </div>
    </div>
  );
}
