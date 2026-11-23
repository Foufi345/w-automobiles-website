"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { getLocalizedSiteConfig, getWhatsAppUrl } from "@/lib/config";
import { gsap, ScrollTrigger, SplitText } from "@/lib/gsap";
import { HERO_MOTION } from "@/lib/hero-motion";
import { HERO_ASSETS, HERO_SCENE } from "@/lib/hero-scene";
import { useIntro } from "@/lib/intro";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { HeroTunnel } from "@/components/hero/HeroTunnel";

/**
 * Module-level flag: persists across client-side locale switches so switching
 * languages never replays the intro, while a hard reload resets it to false.
 */
let heroIntroCompletedInPage = false;

const WATCHDOG_MS = 4500;
const DECODE_TIMEOUT_MS = 1500;
const CAR_GROUP_INTRO_Z = -900;

function awaitImageDecode(
  img: HTMLImageElement | null,
  timeoutMs: number
): Promise<boolean> {
  if (!img) return Promise.resolve(false);

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(ok);
    };

    const timer = setTimeout(() => {
      finish(img.complete && img.naturalWidth > 0);
    }, timeoutMs);

    const runDecode = () => {
      if (img.naturalWidth === 0) {
        finish(false);
        return;
      }
      if (typeof img.decode === "function") {
        img
          .decode()
          .then(() => finish(true))
          .catch(() => finish(img.naturalWidth > 0));
      } else {
        finish(true);
      }
    };

    if (img.complete) {
      runDecode();
    } else {
      img.addEventListener("load", runDecode, { once: true });
      img.addEventListener("error", () => finish(false), { once: true });
    }
  });
}

function setWillChange(
  els: Array<HTMLElement | null | undefined>,
  value: string
) {
  for (const el of els) {
    if (el) el.style.willChange = value;
  }
}

/**
 * Grounded "Showroom Stage" Hero with 3D Showroom Light Tunnel & unified car/ground motion:
 * - <HeroTunnel />: first child of the hero (z-[1]), converging at (--vp-x, --vp-y) directly behind
 *   the car's headlight line and aligned with the showroom floor at --floor-y.
 * - .ground-group: floor plane and left/right floor light pools (clashing shafts/haze ovals removed).
 * - .car-group: car, reflection, tire/under-car contact shadows, ambient occlusion, rim line, and headlight glows.
 * - One-time intro (3.0s desktop / 2.4s mobile):
 *   - .car-group approaches from z -900 -> 0 (opacity 0 -> 1); contact shadows tighten in sync (scaleX 1.4 -> 1, opacity 0 -> 1);
 *     under-car shadow arrives +0.15s later with no bounce.
 *   - Reflection fades in +0.3s after the car (opacity 0 -> 0.5).
 *   - At 1.35s headlights ignite with quick flicker and floor light pools fade in simultaneously.
 *   - Floor fades in over 1.5s to 2.8s, followed by SplitText/CTA reveal.
 * - Endless loops (pausing off-screen and when tab is hidden):
 *   1) WAAPI tunnel flow (translateZ(0) -> translateZ(D))
 *   2) Synchronized left/right headlight glows and floor light pools (opacity 0.8 <-> 1.0, 3.2s, right offset 0.5s).
 */
export function HeroSection() {
  const locale = useLocale();
  const isArabic = locale === "ar";
  const t = useTranslations("home.hero");
  const tCommon = useTranslations("common");
  const tWa = useTranslations("whatsapp");
  const config = getLocalizedSiteConfig(locale);

  const { state: introState, forcedByWatchdog } = useIntro();

  const [imgFailed, setImgFailed] = useState(!HERO_ASSETS.available);
  const [debugOverlay, setDebugOverlay] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [clientReady, setClientReady] = useState(false);
  const [skipTunnelRamp, setSkipTunnelRamp] = useState(false);

  const heroBg = "#0b121a";

  // Refs for hero section, scene container, .ground-group & .car-group layers
  const sectionRef = useRef<HTMLElement | null>(null);
  const sceneBoxRef = useRef<HTMLDivElement | null>(null);
  const groundGroupRef = useRef<HTMLDivElement | null>(null);
  const carGroupRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // .ground-group children
  const floorHazeWrapRef = useRef<HTMLDivElement | null>(null);
  const poolLeftRef = useRef<HTMLDivElement | null>(null);
  const poolRightRef = useRef<HTMLDivElement | null>(null);

  // .car-group children
  const reflectionWrapRef = useRef<HTMLDivElement | null>(null);
  const tireShadowLeftRef = useRef<HTMLDivElement | null>(null);
  const tireShadowRightRef = useRef<HTMLDivElement | null>(null);
  const underCarShadowRef = useRef<HTMLDivElement | null>(null);
  const glowLeftRef = useRef<HTMLDivElement | null>(null);
  const glowRightRef = useRef<HTMLDivElement | null>(null);

  // 2D text elements
  const eyebrowRef = useRef<HTMLDivElement | null>(null);
  const h1aRef = useRef<HTMLSpanElement | null>(null);
  const h1bRef = useRef<HTMLSpanElement | null>(null);
  const subtitleRef = useRef<HTMLParagraphElement | null>(null);
  const cta1Ref = useRef<HTMLAnchorElement | null>(null);
  const cta2Ref = useRef<HTMLAnchorElement | null>(null);
  const brandRef = useRef<HTMLParagraphElement | null>(null);
  const scrollCueRef = useRef<HTMLDivElement | null>(null);

  // Sync --hero-bg on html/body while on the home hero page
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.style.setProperty("--hero-bg", heroBg);
    document.documentElement.classList.add("hero-page-bg");
    return () => {
      document.documentElement.classList.remove("hero-page-bg");
    };
  }, [heroBg]);

  // Detect reduced motion, viewport class & ?debug=1 on client mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const rm =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const coarse =
      window.matchMedia?.("(pointer: coarse)").matches ?? false;
    setReducedMotion(rm);
    setIsMobileViewport(window.innerWidth <= 767 || coarse);
    setSkipTunnelRamp(heroIntroCompletedInPage);
    setClientReady(true);

    const params = new URLSearchParams(window.location.search);
    if (params.get("debug") === "1") {
      setDebugOverlay(true);
    }

    const onResize = () => {
      const isCoarse =
        window.matchMedia?.("(pointer: coarse)").matches ?? false;
      setIsMobileViewport(window.innerWidth <= 767 || isCoarse);
    };
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ResizeObserver: compute --vp-x, --vp-y (headlight center Y in hero coordinates) and --floor-y (tire contact Y in hero coordinates)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sectionEl = sectionRef.current;
    const sceneEl = sceneBoxRef.current;
    if (!sectionEl) return;

    const headlightCenterPct =
      (HERO_SCENE.headlights.left.cy + HERO_SCENE.headlights.right.cy) / 2;
    const tireContactPct =
      (HERO_SCENE.frontTireContacts.left.y +
        HERO_SCENE.frontTireContacts.right.y) /
      2;

    const updateTunnelAnchors = () => {
      const heroRect = sectionEl.getBoundingClientRect();
      if (heroRect.height <= 0 || heroRect.width <= 0) return;

      const sEl = sceneBoxRef.current;
      if (sEl) {
        const sceneRect = sEl.getBoundingClientRect();
        if (sceneRect.height > 0 && sceneRect.width > 0) {
          const vpX =
            sceneRect.left - heroRect.left + sceneRect.width * 0.5;
          const vpY =
            sceneRect.top -
            heroRect.top +
            sceneRect.height * (headlightCenterPct / 100);
          const floorY =
            sceneRect.top -
            heroRect.top +
            sceneRect.height * (tireContactPct / 100);

          sectionEl.style.setProperty("--vp-x", `${vpX.toFixed(1)}px`);
          sectionEl.style.setProperty("--vp-y", `${vpY.toFixed(1)}px`);
          sectionEl.style.setProperty("--floor-y", `${floorY.toFixed(1)}px`);
          return;
        }
      }

      sectionEl.style.setProperty("--vp-x", "50%");
      sectionEl.style.setProperty("--vp-y", "50%");
      sectionEl.style.setProperty("--floor-y", "74%");
    };

    updateTunnelAnchors();

    const ro = new ResizeObserver(() => {
      updateTunnelAnchors();
    });
    ro.observe(sectionEl);
    if (sceneEl) ro.observe(sceneEl);

    return () => {
      ro.disconnect();
    };
  }, [clientReady, imgFailed, locale]);

  // One-time intro + synchronized headlight & floor light-pool opacity pulse loop
  useEffect(() => {
    if (!clientReady || typeof window === "undefined") return;
    if (introState !== "done") return;

    const sectionEl = sectionRef.current;
    if (!sectionEl) return;

    let cancelled = false;
    let introDone = false;
    let watchdogTimer: ReturnType<typeof setTimeout> | null = null;
    let splitA: SplitText | null = null;
    let splitB: SplitText | null = null;
    let introTl: gsap.core.Timeline | null = null;
    const pulseTweens: Array<gsap.core.Tween> = [];

    const getSplitLines = (): HTMLElement[] => {
      const lines: HTMLElement[] = [];
      if (splitA?.lines) lines.push(...(splitA.lines as HTMLElement[]));
      if (splitB?.lines) lines.push(...(splitB.lines as HTMLElement[]));
      return lines;
    };

    const wrapSplitLinesInMasks = () => {
      if (h1aRef.current) {
        splitA = new SplitText(h1aRef.current, {
          type: "lines",
          linesClass: "hero-split-line",
        });
      }
      if (h1bRef.current) {
        splitB = new SplitText(h1bRef.current, {
          type: "lines",
          linesClass: "hero-split-line",
        });
      }
      const allLines = getSplitLines();
      for (const line of allLines) {
        const parent = line.parentElement;
        if (!parent || parent.classList.contains("hero-split-mask")) continue;
        const mask = document.createElement("span");
        mask.className = "hero-split-mask";
        parent.insertBefore(mask, line);
        mask.appendChild(line);
      }
      return allLines;
    };

    const revertSplits = () => {
      const allLines = getSplitLines();
      for (const line of allLines) {
        const mask = line.parentElement;
        if (
          mask &&
          mask.classList.contains("hero-split-mask") &&
          mask.parentElement
        ) {
          mask.parentElement.insertBefore(line, mask);
          mask.remove();
        }
      }
      splitA?.revert();
      splitB?.revert();
      splitA = null;
      splitB = null;
    };

    const forceFinalVisualState = () => {
      introDone = true;
      heroIntroCompletedInPage = true;
      if (watchdogTimer) {
        clearTimeout(watchdogTimer);
        watchdogTimer = null;
      }
      if (introTl) {
        introTl.kill();
        introTl = null;
      }

      const maxOp = HERO_MOTION.headlightLoop.maxOpacity;

      if (carGroupRef.current) {
        gsap.set(carGroupRef.current, {
          z: 0,
          opacity: 1,
        });
      }
      if (reflectionWrapRef.current) {
        gsap.set(reflectionWrapRef.current, { opacity: 0.5 });
      }
      if (tireShadowLeftRef.current) {
        gsap.set(tireShadowLeftRef.current, { scaleX: 1, opacity: 1 });
      }
      if (tireShadowRightRef.current) {
        gsap.set(tireShadowRightRef.current, { scaleX: 1, opacity: 1 });
      }
      if (underCarShadowRef.current) {
        gsap.set(underCarShadowRef.current, { scaleX: 1, opacity: 1 });
      }
      if (floorHazeWrapRef.current) {
        gsap.set(floorHazeWrapRef.current, { opacity: 1 });
      }
      if (glowLeftRef.current) {
        gsap.set(glowLeftRef.current, { opacity: maxOp, scale: 1 });
      }
      if (glowRightRef.current) {
        gsap.set(glowRightRef.current, { opacity: maxOp, scale: 1 });
      }
      if (poolLeftRef.current) {
        gsap.set(poolLeftRef.current, { opacity: maxOp });
      }
      if (poolRightRef.current) {
        gsap.set(poolRightRef.current, { opacity: maxOp });
      }

      const textEls = [
        eyebrowRef.current,
        subtitleRef.current,
        cta1Ref.current,
        cta2Ref.current,
        brandRef.current,
        scrollCueRef.current,
      ].filter(Boolean) as HTMLElement[];
      if (textEls.length > 0) {
        gsap.set(textEls, { opacity: 1, y: 0 });
      }
      const splitLines = getSplitLines();
      if (splitLines.length > 0) {
        gsap.set(splitLines, { opacity: 1, yPercent: 0 });
      }

      // Clear will-change from all one-time intro layers
      setWillChange(
        [
          carGroupRef.current,
          reflectionWrapRef.current,
          tireShadowLeftRef.current,
          tireShadowRightRef.current,
          underCarShadowRef.current,
          floorHazeWrapRef.current,
          ...textEls,
          ...splitLines,
        ],
        "auto"
      );
    };

    let isInViewport = true;
    let isTabVisible = !document.hidden;

    const syncPulseLoop = () => {
      const shouldRun = isInViewport && isTabVisible && !reducedMotion;
      for (const tw of pulseTweens) {
        if (shouldRun) tw.resume();
        else tw.pause();
      }
    };

    const startLightPulseLoop = () => {
      if (cancelled || reducedMotion || pulseTweens.length > 0) return;

      const { minOpacity, maxOpacity, duration, ease, repeat, rightOffset } =
        HERO_MOTION.headlightLoop;

      const leftTargets = [glowLeftRef.current, poolLeftRef.current].filter(
        Boolean
      ) as HTMLElement[];
      const rightTargets = [glowRightRef.current, poolRightRef.current].filter(
        Boolean
      ) as HTMLElement[];

      // Only these 4 elements (2 headlight glows + 2 floor light pools) animate in the GSAP idle loop
      setWillChange([...leftTargets, ...rightTargets], "opacity");

      if (leftTargets.length > 0) {
        gsap.set(leftTargets, { opacity: maxOpacity });
        pulseTweens.push(
          gsap.to(leftTargets, {
            opacity: minOpacity,
            duration: duration / 2,
            ease,
            repeat,
            yoyo: true,
          })
        );
      }

      if (rightTargets.length > 0) {
        gsap.set(rightTargets, { opacity: maxOpacity });
        pulseTweens.push(
          gsap.to(rightTargets, {
            opacity: minOpacity,
            duration: duration / 2,
            delay: rightOffset,
            ease,
            repeat,
            yoyo: true,
          })
        );
      }

      syncPulseLoop();
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        isInViewport = Boolean(entry?.isIntersecting);
        syncPulseLoop();
      },
      { threshold: 0.05 }
    );
    observer.observe(sectionEl);

    const onVisibilityChange = () => {
      isTabVisible = !document.hidden;
      syncPulseLoop();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    if (reducedMotion) {
      forceFinalVisualState();
      setWillChange(
        [
          glowLeftRef.current,
          glowRightRef.current,
          poolLeftRef.current,
          poolRightRef.current,
        ],
        "auto"
      );
      return () => {
        observer.disconnect();
        document.removeEventListener("visibilitychange", onVisibilityChange);
      };
    }

    if (heroIntroCompletedInPage) {
      wrapSplitLinesInMasks();
      forceFinalVisualState();
      startLightPulseLoop();
      return () => {
        cancelled = true;
        observer.disconnect();
        document.removeEventListener("visibilitychange", onVisibilityChange);
        pulseTweens.forEach((tw) => tw.kill());
        revertSplits();
      };
    }

    watchdogTimer = setTimeout(() => {
      if (!introDone && !cancelled) {
        forceFinalVisualState();
        startLightPulseLoop();
      }
    }, WATCHDOG_MS);

    const startOrchestration = async () => {
      const decodedOk =
        !imgFailed && HERO_ASSETS.available
          ? await awaitImageDecode(imgRef.current, DECODE_TIMEOUT_MS)
          : false;

      if (cancelled || introDone) return;

      if (!decodedOk) {
        if (!imgFailed) setImgFailed(true);
        forceFinalVisualState();
        ScrollTrigger.refresh();
        return;
      }

      ScrollTrigger.refresh();

      const splitLines = wrapSplitLinesInMasks();
      const targetIntroDur = isMobileViewport
        ? HERO_MOTION.introDuration.mobile
        : HERO_MOTION.introDuration.desktop;
      const tScale = targetIntroDur / HERO_MOTION.introDuration.desktop;

      const textNodes = [
        eyebrowRef.current,
        subtitleRef.current,
        cta1Ref.current,
        cta2Ref.current,
        brandRef.current,
        scrollCueRef.current,
      ].filter(Boolean) as HTMLElement[];

      const tireShadows = [
        tireShadowLeftRef.current,
        tireShadowRightRef.current,
      ].filter(Boolean) as HTMLElement[];

      const glows = [glowLeftRef.current, glowRightRef.current].filter(
        Boolean
      ) as HTMLElement[];

      const pools = [poolLeftRef.current, poolRightRef.current].filter(
        Boolean
      ) as HTMLElement[];

      setWillChange(
        [
          carGroupRef.current,
          reflectionWrapRef.current,
          ...tireShadows,
          underCarShadowRef.current,
          floorHazeWrapRef.current,
          ...glows,
          ...pools,
          ...textNodes,
          ...splitLines,
        ],
        "transform, opacity"
      );

      // Initial pre-intro states
      if (carGroupRef.current) {
        gsap.set(carGroupRef.current, {
          z: CAR_GROUP_INTRO_Z,
          opacity: 0,
        });
      }
      if (tireShadows.length > 0) {
        gsap.set(tireShadows, {
          scaleX: 1.4,
          opacity: 0,
        });
      }
      if (underCarShadowRef.current) {
        gsap.set(underCarShadowRef.current, {
          scaleX: 1.4,
          opacity: 0,
        });
      }
      if (reflectionWrapRef.current) {
        gsap.set(reflectionWrapRef.current, { opacity: 0 });
      }
      if (floorHazeWrapRef.current) {
        gsap.set(floorHazeWrapRef.current, { opacity: 0 });
      }
      if (glows.length > 0) {
        gsap.set(glows, { opacity: 0, scale: 0.85 });
      }
      if (pools.length > 0) {
        gsap.set(pools, { opacity: 0 });
      }

      if (eyebrowRef.current) gsap.set(eyebrowRef.current, { opacity: 0, y: 16 });
      if (splitLines.length > 0) gsap.set(splitLines, { opacity: 0, yPercent: 110 });
      if (subtitleRef.current) gsap.set(subtitleRef.current, { opacity: 0, y: 20 });
      if (cta1Ref.current) gsap.set(cta1Ref.current, { opacity: 0, y: 24 });
      if (cta2Ref.current) gsap.set(cta2Ref.current, { opacity: 0, y: 24 });
      if (brandRef.current) gsap.set(brandRef.current, { opacity: 0, y: 14 });
      if (scrollCueRef.current) gsap.set(scrollCueRef.current, { opacity: 0, y: 10 });

      const tl = gsap.timeline({
        onComplete: () => {
          if (cancelled) return;
          introDone = true;
          heroIntroCompletedInPage = true;
          if (watchdogTimer) {
            clearTimeout(watchdogTimer);
            watchdogTimer = null;
          }
          setWillChange(
            [
              carGroupRef.current,
              reflectionWrapRef.current,
              ...tireShadows,
              underCarShadowRef.current,
              floorHazeWrapRef.current,
              ...textNodes,
              ...splitLines,
            ],
            "auto"
          );
          startLightPulseLoop();
        },
      });
      introTl = tl;

      // 1. .car-group approaches from far behind (z -900 -> 0, opacity 0 -> 1)
      if (carGroupRef.current) {
        tl.to(
          carGroupRef.current,
          {
            z: 0,
            duration: 2.5 * tScale,
            ease: "expo.out",
          },
          0
        );
        tl.to(
          carGroupRef.current,
          {
            opacity: 1,
            duration: 1.15 * tScale,
            ease: "power3.out",
          },
          0
        );
      }

      // 2. Contact shadows tighten in sync with the car (scaleX 1.4 -> 1, opacity 0 -> 1)
      if (tireShadows.length > 0) {
        tl.to(
          tireShadows,
          {
            scaleX: 1,
            duration: 2.5 * tScale,
            ease: "expo.out",
          },
          0
        );
        tl.to(
          tireShadows,
          {
            opacity: 1,
            duration: 1.15 * tScale,
            ease: "power3.out",
          },
          0
        );
      }

      // Under-car shadow arrives +0.15s later with no bounce
      if (underCarShadowRef.current) {
        tl.to(
          underCarShadowRef.current,
          {
            scaleX: 1,
            duration: 2.35 * tScale,
            ease: "expo.out",
          },
          0.15 * tScale
        );
        tl.to(
          underCarShadowRef.current,
          {
            opacity: 1,
            duration: 1.1 * tScale,
            ease: "power3.out",
          },
          0.15 * tScale
        );
      }

      // 3. Reflection fades in 0.3s after the car (opacity 0 -> 0.5)
      if (reflectionWrapRef.current) {
        tl.to(
          reflectionWrapRef.current,
          {
            opacity: 0.5,
            duration: 1.35 * tScale,
            ease: "power3.out",
          },
          0.3 * tScale
        );
      }

      // 4. At 1.35s headlights ignite with quick flicker, and floor light pools fade in at the same moment
      const igniteAt = 1.35 * tScale;
      const maxOp = HERO_MOTION.headlightLoop.maxOpacity;

      if (glows.length > 0) {
        tl.to(
          glows,
          {
            scale: 1,
            duration: 0.45 * tScale,
            ease: "power3.out",
          },
          igniteAt
        );
        tl.to(
          glows,
          {
            keyframes: [
              { opacity: maxOp, duration: 0.08 * tScale },
              { opacity: 0.35 * maxOp, duration: 0.08 * tScale },
              { opacity: 0.9 * maxOp, duration: 0.1 * tScale },
              { opacity: 0.5 * maxOp, duration: 0.09 * tScale },
              { opacity: maxOp, duration: 0.15 * tScale },
            ],
            ease: "none",
          },
          igniteAt
        );
      }

      if (pools.length > 0) {
        tl.to(
          pools,
          {
            opacity: maxOp,
            duration: 0.5 * tScale,
            ease: "power3.out",
          },
          igniteAt
        );
      }

      // 5. Floor plane fades in over 1.5s to 2.8s (duration 1.3s starting at 1.5s)
      if (floorHazeWrapRef.current) {
        tl.to(
          floorHazeWrapRef.current,
          {
            opacity: 1,
            duration: 1.3 * tScale,
            ease: "power3.out",
          },
          1.5 * tScale
        );
      }

      // 6. Text reveal (finishes by ~3.0s desktop / 2.4s mobile)
      if (eyebrowRef.current) {
        tl.to(
          eyebrowRef.current,
          { opacity: 1, y: 0, duration: 0.65 * tScale, ease: "power3.out" },
          1.5 * tScale
        );
      }
      if (splitLines.length > 0) {
        tl.to(
          splitLines,
          {
            yPercent: 0,
            opacity: 1,
            duration: 0.85 * tScale,
            stagger: 0.1 * tScale,
            ease: "expo.out",
          },
          1.6 * tScale
        );
      }
      if (subtitleRef.current) {
        tl.to(
          subtitleRef.current,
          { opacity: 1, y: 0, duration: 0.7 * tScale, ease: "power3.out" },
          1.9 * tScale
        );
      }
      const ctas = [cta1Ref.current, cta2Ref.current].filter(Boolean) as HTMLElement[];
      if (ctas.length > 0) {
        tl.to(
          ctas,
          {
            opacity: 1,
            y: 0,
            duration: 0.75 * tScale,
            stagger: 0.1 * tScale,
            ease: "power3.out",
          },
          2.05 * tScale
        );
      }
      if (brandRef.current) {
        tl.to(
          brandRef.current,
          { opacity: 1, y: 0, duration: 0.65 * tScale, ease: "power3.out" },
          2.25 * tScale
        );
      }
      if (scrollCueRef.current) {
        tl.to(
          scrollCueRef.current,
          { opacity: 0.7, y: 0, duration: 0.55 * tScale, ease: "power3.out" },
          2.4 * tScale
        );
      }
    };

    void startOrchestration();

    return () => {
      cancelled = true;
      if (watchdogTimer) {
        clearTimeout(watchdogTimer);
        watchdogTimer = null;
      }
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      introTl?.kill();
      pulseTweens.forEach((tw) => tw.kill());
      revertSplits();
    };
  }, [introState, clientReady, reducedMotion, isMobileViewport, imgFailed]);

  const {
    carHeightFrac,
    carSrc,
    carWidth,
    carHeight,
    carBoundingBox,
    roofY,
    bodyBottomY,
    lowestY,
    horizonY,
    frontTireContacts,
    headlights,
  } = HERO_SCENE;

  const carHeightPct = carHeightFrac * 100;
  const reflectionHeightPct = carHeightPct * 0.72;

  // Tight headlight glow dimensions (~135% width, ~140% height, clamped inside car silhouette)
  const leftGlowW = headlights.left.width * 1.35;
  const leftGlowH = headlights.left.height * 1.4;
  const leftGlowLeft = Math.max(
    carBoundingBox.xStart + 0.5,
    headlights.left.cx - leftGlowW / 2
  );

  const rightGlowW = headlights.right.width * 1.35;
  const rightGlowH = headlights.right.height * 1.4;
  const rightGlowLeft = Math.min(
    carBoundingBox.xEnd - 0.5 - rightGlowW,
    headlights.right.cx - rightGlowW / 2
  );

  // Per-tire contact shadow dimensions
  const tireShadowW = 19.6;
  const tireShadowH = Number(
    (tireShadowW * HERO_SCENE.aspectRatioNumber * 0.14).toFixed(2)
  );
  const underCarW = 92;
  const underCarH = Number((9 * carHeightFrac).toFixed(2));

  return (
    <section
      ref={sectionRef}
      data-intro-state={introState}
      data-intro-watchdog={forcedByWatchdog ? "true" : "false"}
      style={
        {
          "--hero-bg": heroBg,
          backgroundColor: heroBg,
        } as React.CSSProperties
      }
      className="hero-stage relative isolate w-full overflow-hidden"
    >
      {/* FIRST CHILD OF HERO: 3D Animated Showroom Light Tunnel Background (z-[1], below car scene) */}
      <HeroTunnel
        isMobileViewport={isMobileViewport}
        reducedMotion={reducedMotion}
        introReady={clientReady && introState === "done"}
        skipIntroRamp={skipTunnelRamp}
        debugOverlay={debugOverlay}
      />

      {/* ROW 1 (auto): Eyebrow Badge + Real Semantic H1 */}
      <div className="hero-stage-top flex w-full max-w-4xl flex-col items-center text-center">
        <div
          ref={eyebrowRef}
          data-hero-reveal=""
          className="hero-eyebrow inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/35 px-3.5 py-1"
        >
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-red"
          />
          <span
            className={
              isArabic
                ? "text-xs font-medium text-silver"
                : "text-[11px] sm:text-xs font-medium uppercase tracking-[0.2em] text-silver"
            }
          >
            {t("badge")}
          </span>
        </div>

        <h1
          data-hero-reveal=""
          className="mt-2 sm:mt-2.5 flex flex-col items-center font-serif text-ivory"
        >
          <span
            ref={h1aRef}
            className={
              isArabic
                ? "hero-h1a font-sans font-medium text-silver"
                : "hero-h1a font-sans font-medium uppercase tracking-[0.35em] text-silver"
            }
          >
            {t("h1a")}
          </span>{" "}
          <span
            ref={h1bRef}
            className="hero-h1b hero-text-shadow mt-0.5 sm:mt-1 font-semibold leading-[1.06] tracking-tight text-ivory"
          >
            {t("h1b")}
            <em
              className={
                isArabic
                  ? "not-italic font-bold text-ivory"
                  : "italic font-normal text-ivory/95"
              }
            >
              {t("h1bAccent")}
            </em>
          </span>
        </h1>
      </div>

      {/* ROW 2 (minmax(0, 1fr)): Grounded Car (.car-group) + Showroom Floor (.ground-group) */}
      <div className="hero-car-row">
        <div className="hero-world">
          {!imgFailed && HERO_ASSETS.available && (
            <div
              ref={sceneBoxRef}
              className="hero-stage-scene select-none"
              style={
                {
                  aspectRatio: HERO_SCENE.aspectRatio,
                  "--scene-ar": HERO_SCENE.aspectRatioNumber,
                } as React.CSSProperties
              }
            >
              {/* SIBLING 1: .ground-group (perspective floor plane + pulsing floor light pools) */}
              <div
                ref={groundGroupRef}
                aria-hidden="true"
                className="ground-group pointer-events-none absolute inset-0 z-[1]"
              >
                {/* F0. FLOOR PLANE (fades in over 1.5s..2.8s; old shafts/haze ovals removed so tunnel stays clean) */}
                <div
                  ref={floorHazeWrapRef}
                  className="absolute inset-0"
                  style={{ opacity: 1 }}
                >
                  <div
                    className="hero-floor-perspective z-[1]"
                    style={{ top: `${horizonY}%` }}
                  >
                    <div className="hero-floor-plane">
                      {!isMobileViewport && <div className="hero-floor-noise" />}
                    </div>
                  </div>
                </div>

                {/* F3. HEADLIGHT LIGHT POOLS ON THE FLOOR (fade in at 1.35s, then pulse with headlights) */}
                <div
                  ref={poolLeftRef}
                  data-hero-pool="left"
                  className="absolute inset-0 z-[3]"
                  style={{ opacity: HERO_MOTION.headlightLoop.maxOpacity }}
                >
                  <div
                    className="absolute"
                    style={{
                      left: `${headlights.left.cx - 21}%`,
                      top: `${lowestY - 1}%`,
                      width: "38%",
                      height: "36%",
                      transformOrigin: "50% 0%",
                      transform: "scaleY(0.35)",
                      background:
                        "radial-gradient(ellipse at 52% 28%, rgba(228, 240, 255, 0.24) 0%, rgba(195, 218, 248, 0.09) 46%, transparent 74%)",
                    }}
                  />
                  <div
                    className="absolute"
                    style={{
                      left: `${headlights.left.cx - 7}%`,
                      top: `${lowestY + 2}%`,
                      width: "14%",
                      height: "34%",
                      background:
                        "radial-gradient(ellipse 44% 85% at 50% 10%, rgba(220, 236, 255, 0.12) 0%, rgba(190, 215, 245, 0.04) 55%, transparent 88%)",
                    }}
                  />
                </div>

                <div
                  ref={poolRightRef}
                  data-hero-pool="right"
                  className="absolute inset-0 z-[3]"
                  style={{ opacity: HERO_MOTION.headlightLoop.maxOpacity }}
                >
                  <div
                    className="absolute"
                    style={{
                      left: `${headlights.right.cx - 17}%`,
                      top: `${lowestY - 1}%`,
                      width: "38%",
                      height: "36%",
                      transformOrigin: "50% 0%",
                      transform: "scaleY(0.35)",
                      background:
                        "radial-gradient(ellipse at 48% 28%, rgba(228, 240, 255, 0.24) 0%, rgba(195, 218, 248, 0.09) 46%, transparent 74%)",
                    }}
                  />
                  <div
                    className="absolute"
                    style={{
                      left: `${headlights.right.cx - 7}%`,
                      top: `${lowestY + 2}%`,
                      width: "14%",
                      height: "34%",
                      background:
                        "radial-gradient(ellipse 44% 85% at 50% 10%, rgba(220, 236, 255, 0.12) 0%, rgba(190, 215, 245, 0.04) 55%, transparent 88%)",
                    }}
                  />
                </div>
              </div>

              {/* SIBLING 2: .car-group (car, reflection, and contact shadows move together as ONE group) */}
              <div
                ref={carGroupRef}
                className="car-group absolute inset-0 z-[2]"
              >
                {/* F2. REFLECTION: reuses same loaded car image, scaleY(-1), fades in +0.3s after car to opacity 0.5 */}
                <div
                  ref={reflectionWrapRef}
                  data-hero-reflection=""
                  aria-hidden="true"
                  className="hero-reflection-mask pointer-events-none absolute inset-x-0 z-[1] overflow-hidden"
                  style={{
                    top: `${lowestY}%`,
                    height: `${reflectionHeightPct}%`,
                    opacity: 0.5,
                  }}
                >
                  <img
                    src={carSrc}
                    alt=""
                    width={carWidth}
                    height={carHeight}
                    decoding="async"
                    className="block h-full w-full object-fill"
                    style={{
                      transform: "scaleY(-1)",
                    }}
                  />
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        "linear-gradient(to bottom, rgba(220,235,255,0.06) 0%, transparent 18%, rgba(220,235,255,0.03) 34%, transparent 56%)",
                      WebkitMaskImage:
                        "linear-gradient(to right, transparent 0%, #000 22%, #000 78%, transparent 100%)",
                      maskImage:
                        "linear-gradient(to right, transparent 0%, #000 22%, #000 78%, transparent 100%)",
                    }}
                  />
                </div>

                {/* F4. CONTACT SHADOWS (move with .car-group so they never detach from the tires) */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 z-[2]"
                >
                  {/* Under-car shadow (+0.15s delay in intro, no bounce) */}
                  <div
                    ref={underCarShadowRef}
                    data-hero-shadow="under-car"
                    className="absolute inset-0"
                  >
                    {!isMobileViewport && (
                      <div
                        className="absolute"
                        style={{
                          left: "-12.5%",
                          top: `${lowestY - 6.5}%`,
                          width: "125%",
                          height: "14%",
                          opacity: 0.35,
                          background:
                            "radial-gradient(ellipse at center, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.35) 48%, transparent 74%)",
                        }}
                      />
                    )}
                    <div
                      className="absolute"
                      style={{
                        left: `${(100 - underCarW) / 2}%`,
                        top: `${bodyBottomY - 0.5}%`,
                        width: `${underCarW}%`,
                        height: `${underCarH + 4}%`,
                        opacity: 0.78,
                        background:
                          "radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0.94) 0%, rgba(0,0,0,0.62) 52%, transparent 78%)",
                      }}
                    />
                  </div>

                  {/* Left tire contact shadow (tightens scaleX 1.4 -> 1 in sync with car approach) */}
                  <div
                    ref={tireShadowLeftRef}
                    data-hero-shadow="tire-left"
                    className="absolute"
                    style={{
                      left: `${frontTireContacts.left.x - tireShadowW / 2}%`,
                      top: `${frontTireContacts.left.y - tireShadowH / 2}%`,
                      width: `${tireShadowW}%`,
                      height: `${tireShadowH}%`,
                      transformOrigin: "50% 50%",
                      background:
                        "radial-gradient(ellipse at center, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.72) 45%, transparent 76%)",
                    }}
                  />

                  {/* Right tire contact shadow (tightens scaleX 1.4 -> 1 in sync with car approach) */}
                  <div
                    ref={tireShadowRightRef}
                    data-hero-shadow="tire-right"
                    className="absolute"
                    style={{
                      left: `${frontTireContacts.right.x - tireShadowW / 2}%`,
                      top: `${frontTireContacts.right.y - tireShadowH / 2}%`,
                      width: `${tireShadowW}%`,
                      height: `${tireShadowH}%`,
                      transformOrigin: "50% 50%",
                      background:
                        "radial-gradient(ellipse at center, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.72) 45%, transparent 76%)",
                    }}
                  />
                </div>

                {/* F5. THE CAR */}
                <div
                  className="absolute inset-x-0 z-[3]"
                  style={{ top: "0.35%", height: `${carHeightPct}%` }}
                >
                  <img
                    ref={imgRef}
                    src={carSrc}
                    alt={t("imageAlt")}
                    width={carWidth}
                    height={carHeight}
                    fetchPriority="high"
                    decoding="async"
                    loading="eager"
                    onLoad={() => ScrollTrigger.refresh()}
                    onError={() => setImgFailed(true)}
                    className="block h-full w-full object-contain"
                  />
                </div>

                {/* F6. CAR AMBIENT OCCLUSION */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 z-[4]"
                  style={{
                    top: "0.35%",
                    height: `${carHeightPct}%`,
                    WebkitMaskImage: `url("${carSrc}")`,
                    WebkitMaskSize: "100% 100%",
                    WebkitMaskRepeat: "no-repeat",
                    maskImage: `url("${carSrc}")`,
                    maskSize: "100% 100%",
                    maskRepeat: "no-repeat",
                    background:
                      "linear-gradient(to top, rgba(5, 8, 12, 0.75) 0%, rgba(5, 8, 12, 0.25) 6%, transparent 12%)",
                  }}
                />

                {/* F7. FLOOR RIM LIGHT LINE */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute z-[5]"
                  style={{
                    left: "7%",
                    width: "86%",
                    top: `${lowestY + 0.9}%`,
                    height: "1.5px",
                    opacity: 0.16,
                    background:
                      "linear-gradient(90deg, transparent 0%, rgba(220,235,255,0.85) 26%, rgba(242,248,255,1) 50%, rgba(220,235,255,0.85) 74%, transparent 100%)",
                  }}
                />

                {/* Headlight Glow Halos (ignite at 1.35s, then pulse together with floor light pools) */}
                <div
                  ref={glowLeftRef}
                  data-hero-glow="left"
                  aria-hidden="true"
                  className="pointer-events-none absolute z-[6] rounded-full"
                  style={{
                    left: `${leftGlowLeft}%`,
                    top: `${headlights.left.cy - leftGlowH / 2}%`,
                    width: `${leftGlowW}%`,
                    height: `${leftGlowH}%`,
                    transformOrigin: "center center",
                    opacity: HERO_MOTION.headlightLoop.maxOpacity,
                    background:
                      "radial-gradient(ellipse at center, rgba(255,255,255,0.24) 0%, rgba(215,232,255,0.08) 46%, transparent 72%)",
                  }}
                />
                <div
                  ref={glowRightRef}
                  data-hero-glow="right"
                  aria-hidden="true"
                  className="pointer-events-none absolute z-[6] rounded-full"
                  style={{
                    left: `${rightGlowLeft}%`,
                    top: `${headlights.right.cy - rightGlowH / 2}%`,
                    width: `${rightGlowW}%`,
                    height: `${rightGlowH}%`,
                    transformOrigin: "center center",
                    opacity: HERO_MOTION.headlightLoop.maxOpacity,
                    background:
                      "radial-gradient(ellipse at center, rgba(255,255,255,0.24) 0%, rgba(215,232,255,0.08) 46%, transparent 72%)",
                  }}
                />
              </div>

              {/* Dev-only ?debug=1 overlay */}
              {debugOverlay && (
                <div className="pointer-events-none absolute inset-0 z-20">
                  <div
                    style={{
                      left: `${carBoundingBox.xStart}%`,
                      top: `${carBoundingBox.yStart}%`,
                      width: `${carBoundingBox.xEnd - carBoundingBox.xStart}%`,
                      height: `${carBoundingBox.yEnd - carBoundingBox.yStart}%`,
                    }}
                    className="absolute border border-cyan-400/80"
                  />
                  <div
                    style={{ left: "-20%", width: "140%", top: `${horizonY}%` }}
                    className="absolute border-t border-dashed border-sky-400"
                  >
                    <span className="bg-black/80 px-1 text-[9px] font-mono text-sky-300">
                      horizon {horizonY}%
                    </span>
                  </div>
                  <div
                    style={{ left: 0, width: "100%", top: `${bodyBottomY}%` }}
                    className="absolute border-t border-dashed border-yellow-400/80"
                  />
                  <div
                    style={{ left: "-10%", width: "120%", top: `${lowestY}%` }}
                    className="absolute border-t-2 border-emerald-400"
                  >
                    <span className="bg-black/80 px-1 text-[9px] font-mono text-emerald-300">
                      lowestY / reflection {lowestY}%
                    </span>
                  </div>
                  <div
                    style={{
                      left: `${(100 - underCarW) / 2}%`,
                      top: `${bodyBottomY - 0.5}%`,
                      width: `${underCarW}%`,
                      height: `${underCarH + 4}%`,
                    }}
                    className="absolute rounded-full border border-purple-400/80"
                  />
                  <div
                    style={{
                      left: `${frontTireContacts.left.x - tireShadowW / 2}%`,
                      top: `${frontTireContacts.left.y - tireShadowH / 2}%`,
                      width: `${tireShadowW}%`,
                      height: `${tireShadowH}%`,
                    }}
                    className="absolute rounded-full border border-rose-400"
                  />
                  <div
                    style={{
                      left: `${frontTireContacts.right.x - tireShadowW / 2}%`,
                      top: `${frontTireContacts.right.y - tireShadowH / 2}%`,
                      width: `${tireShadowW}%`,
                      height: `${tireShadowH}%`,
                    }}
                    className="absolute rounded-full border border-rose-400"
                  />
                  <div
                    style={{
                      left: `${frontTireContacts.left.x}%`,
                      top: `${frontTireContacts.left.y}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                    className="absolute h-2.5 w-2.5 rounded-full border-2 border-brand-red bg-brand-red"
                  />
                  <div
                    style={{
                      left: `${frontTireContacts.right.x}%`,
                      top: `${frontTireContacts.right.y}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                    className="absolute h-2.5 w-2.5 rounded-full border-2 border-brand-red bg-brand-red"
                  />
                  <div
                    style={{
                      left: `${headlights.left.cx - headlights.left.width / 2}%`,
                      top: `${headlights.left.cy - headlights.left.height / 2}%`,
                      width: `${headlights.left.width}%`,
                      height: `${headlights.left.height}%`,
                    }}
                    className="absolute border border-amber-400"
                  />
                  <div
                    style={{
                      left: `${headlights.right.cx - headlights.right.width / 2}%`,
                      top: `${headlights.right.cy - headlights.right.height / 2}%`,
                      width: `${headlights.right.width}%`,
                      height: `${headlights.right.height}%`,
                    }}
                    className="absolute border border-amber-400"
                  />
                  <div
                    style={{ left: 0, width: "100%", top: `${roofY}%` }}
                    className="absolute border-t border-blue-400/70"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ROW 3 (auto): Subtitle + Two CTAs (simple color/border hover only) + Brand Line + Static Scroll Cue */}
      <div className="hero-stage-bottom hero-actions-scrim flex w-full max-w-2xl flex-col items-center px-3 py-1 text-center">
        <p
          ref={subtitleRef}
          data-hero-reveal=""
          className="hero-subtitle-shadow max-w-xl text-xs sm:text-sm md:text-base text-silver"
        >
          {t("subtitle")}
        </p>

        <div className="hero-stage-cta-row mt-2.5 sm:mt-3.5 flex w-full max-w-md sm:max-w-none flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 sm:gap-3">
          <Link
            ref={cta1Ref}
            data-hero-reveal=""
            href="/vehicules"
            className="inline-flex min-h-[44px] sm:min-h-[48px] items-center justify-center gap-2 rounded-xl border border-brand-red bg-navy-950/90 px-5 sm:px-7 py-2.5 sm:py-3 text-sm font-semibold text-ivory shadow-lg shadow-black/40 transition-colors hover:bg-brand-red hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ivory focus-visible:ring-offset-2 focus-visible:ring-offset-navy-950"
          >
            <span>{t("ctaVehicles")}</span>
            <span aria-hidden="true" className="rtl:rotate-180">
              &rarr;
            </span>
          </Link>

          <a
            ref={cta2Ref}
            data-hero-reveal=""
            href={getWhatsAppUrl(tWa("genericMessage"))}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] sm:min-h-[48px] items-center justify-center gap-2.5 rounded-xl border border-whatsapp-green bg-navy-950/85 px-5 sm:px-7 py-2.5 sm:py-3 text-sm font-semibold text-whatsapp-green transition-colors hover:bg-whatsapp-green hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-whatsapp-green focus-visible:ring-offset-2 focus-visible:ring-offset-navy-950"
          >
            <WhatsAppIcon className="h-5 w-5 shrink-0 fill-current" />
            <span>{tCommon("whatsapp")}</span>
          </a>
        </div>

        {/* Brand line: hidden below 760px viewport height and below lg width */}
        <p
          ref={brandRef}
          data-hero-reveal=""
          dir="ltr"
          className="hero-brand-line hidden lg:block mt-3 whitespace-nowrap text-[11px] font-medium uppercase tracking-[0.26em] text-silver/65"
        >
          {config.brands.join("  ·  ")}
        </p>

        {/* Static scroll cue: hidden below 700px viewport height */}
        <div
          ref={scrollCueRef}
          aria-hidden="true"
          className="hero-stage-scroll mt-2.5 hidden sm:flex flex-col items-center gap-1 opacity-70"
        >
          <span
            className={
              isArabic
                ? "text-[11px] font-medium text-silver/80"
                : "text-[10px] font-medium uppercase tracking-[0.24em] text-silver/80"
            }
          >
            {t("scroll")}
          </span>
          <span className="h-3 w-[1px] bg-gradient-to-b from-brand-red to-transparent" />
        </div>
      </div>
    </section>
  );
}
