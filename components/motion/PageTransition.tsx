"use client";

import { useCallback, useEffect, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { scheduleScrollRefresh } from "@/lib/refreshScroll";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import {
  useTransitionState,
  setTransitionPhase,
  setNavigationKind,
  saveScrollPosition,
  getSavedScrollPosition,
  getTransitionSnapshot,
  assertScrollTriggerCountStable,
} from "@/lib/transition";

const COVER_DURATION_DESKTOP = 0.45;
const REVEAL_DURATION_DESKTOP = 0.45;
const COVER_DURATION_MOBILE = 0.22;
const REVEAL_DURATION_MOBILE = 0.24;
const WATCHDOG_MS = 1200;

function isCompactViewport(): boolean {
  return typeof window !== "undefined" && window.innerWidth < 768;
}

interface LenisLike {
  scroll?: number;
  stop?: () => void;
  start?: () => void;
  resize?: () => void;
  scrollTo?: (
    y: number,
    opts?: { immediate?: boolean; force?: boolean }
  ) => void;
}

function getLenis(): LenisLike | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { __lenis?: LenisLike }).__lenis;
}

export function PageTransition() {
  const locale = useLocale();
  const tCommon = useTranslations("common");
  const router = useRouter();
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();
  const prevLocaleRef = useRef(locale);
  const { state: transitionPhase, readyPathname, readySeq } = useTransitionState();

  const overlayRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const activeTlRef = useRef<gsap.core.Timeline | null>(null);
  const watchdogRef = useRef<number | null>(null);
  const pendingDestRef = useRef<{
    pathname: string;
    locale?: AppLocale;
  } | null>(null);
  const prevPathnameRef = useRef<string>(pathname);

  const clearWatchdog = useCallback(() => {
    if (watchdogRef.current !== null) {
      window.clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
  }, []);

  // Ensure overlay starts hidden at bottom & manual scroll restoration is active
  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    if (overlayRef.current) {
      gsap.set(overlayRef.current, {
        clipPath: "polygon(0% 100%, 100% 100%, 100% 100%, 0% 100%)",
        pointerEvents: "none",
      });
    }
    return () => {
      clearWatchdog();
      activeTlRef.current?.kill();
    };
  }, [clearWatchdog]);

  // Helper: sync Lenis + ScrollTrigger + apply target scroll (0 on push, saved on pop)
  const syncScrollAndRefresh = useCallback((routeKey: string) => {
    const lenis = getLenis();
    const { navigationKind } = getTransitionSnapshot();
    const isPop = navigationKind === "pop";
    const targetY = isPop ? getSavedScrollPosition(routeKey) : 0;

    const applyScroll = () => {
      lenis?.resize?.();
      ScrollTrigger.refresh();
      if (lenis?.scrollTo) {
        lenis.scrollTo(targetY, { immediate: true, force: true });
      }
      window.scrollTo({ top: targetY, left: 0, behavior: "instant" });
      ScrollTrigger.update();
    };

    applyScroll();
    if (isPop && targetY > 0) {
      // Re-apply after Next.js App Router's post-commit ScrollAndFocusHandler
      requestAnimationFrame(() => {
        requestAnimationFrame(applyScroll);
      });
    }

    setNavigationKind("push");
  }, []);

  // Play reveal animation (0.45s), unlock Lenis, and return to "idle"
  const playReveal = useCallback(
    (routeKey: string, currentPath: string) => {
      clearWatchdog();
      activeTlRef.current?.kill();

      const overlay = overlayRef.current;
      const content = contentRef.current;

      setTransitionPhase("revealing");

      // Sync scroll & ScrollTrigger after new route is mounted
      syncScrollAndRefresh(routeKey);

      if (!overlay || prefersReducedMotion) {
        if (overlay) {
          gsap.set(overlay, {
            clipPath: "polygon(0% 100%, 100% 100%, 100% 100%, 0% 100%)",
            pointerEvents: "none",
          });
        }
        getLenis()?.start?.();
        pendingDestRef.current = null;
        setTransitionPhase("idle");
        window.setTimeout(() => assertScrollTriggerCountStable(currentPath), 200);
        return;
      }

      const tl = gsap.timeline({
        onComplete: () => {
          gsap.set(overlay, {
            clipPath: "polygon(0% 100%, 100% 100%, 100% 100%, 0% 100%)",
            pointerEvents: "none",
          });
          getLenis()?.start?.();
          pendingDestRef.current = null;
          setTransitionPhase("idle");
          window.setTimeout(
            () => assertScrollTriggerCountStable(currentPath),
            200
          );
        },
      });
      activeTlRef.current = tl;

      if (content) {
        tl.to(content, {
          opacity: 0,
          y: -10,
          duration: 0.2,
          ease: "power2.in",
        });
      }

      tl.to(
        overlay,
        {
          clipPath: "polygon(0% 0%, 100% 0%, 100% 0%, 0% 0%)",
          duration: isCompactViewport()
            ? REVEAL_DURATION_MOBILE
            : REVEAL_DURATION_DESKTOP,
          ease: "power3.inOut",
        },
        content ? "-=0.1" : 0
      );
    },
    [clearWatchdog, prefersReducedMotion, syncScrollAndRefresh]
  );

  // On locale change: subtle 0.25s content fade + debounced ScrollTrigger.refresh() after fonts ready
  useEffect(() => {
    if (prevLocaleRef.current === locale) return;
    prevLocaleRef.current = locale;

    if (!prefersReducedMotion && typeof document !== "undefined") {
      const main = document.getElementById("main-content");
      if (main) {
        gsap.fromTo(
          main,
          { opacity: 0.72 },
          {
            opacity: 1,
            duration: 0.25,
            ease: "power2.out",
            clearProps: "opacity",
          }
        );
      }
    }

    const triggerRefresh = () => scheduleScrollRefresh(150);
    if (typeof document !== "undefined" && document.fonts?.ready) {
      document.fonts.ready.then(triggerRefresh).catch(triggerRefresh);
    } else {
      triggerRefresh();
    }
  }, [locale, prefersReducedMotion]);

  // Listen for browser Back/Forward (popstate)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handlePopState = () => {
      const prevKey = prevPathnameRef.current + window.location.search;
      saveScrollPosition(prevKey, window.scrollY);
      setNavigationKind("pop");
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // React to NEW route mounting (pathname changed AND app/template.tsx signaled pageReady)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (readyPathname !== pathname) return;

    const routeKey = pathname + window.location.search;
    const pathChanged = pathname !== prevPathnameRef.current;
    prevPathnameRef.current = pathname;

    const phase = getTransitionSnapshot().state;

    if (phase === "waiting" || phase === "covering") {
      requestAnimationFrame(() => {
        playReveal(routeKey, pathname);
      });
      return;
    }

    if (pathChanged) {
      // Browser back/forward or programmatic navigation without cover
      requestAnimationFrame(() => {
        syncScrollAndRefresh(routeKey);
        getLenis()?.start?.();
        setTransitionPhase("idle");
        window.setTimeout(() => assertScrollTriggerCountStable(pathname), 200);
      });
    }
  }, [pathname, readyPathname, readySeq, playReveal, syncScrollAndRefresh]);

  // Intercept internal link clicks (supports rapid clicking without stacking covers)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleDocumentClick = (e: MouseEvent) => {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        e.shiftKey
      ) {
        return;
      }

      const target = (e.target as HTMLElement | null)?.closest("a");
      if (!target) return;

      const href = target.getAttribute("href");
      if (!href) return;

      if (
        target.hasAttribute("data-locale-switch") ||
        target.target === "_blank" ||
        target.hasAttribute("download") ||
        href.startsWith("tel:") ||
        href.startsWith("mailto:") ||
        href.startsWith("https://wa.me") ||
        href.startsWith("http://wa.me") ||
        href.startsWith("#")
      ) {
        return;
      }

      let currentUrl: URL;
      let targetUrl: URL;
      try {
        currentUrl = new URL(window.location.href);
        targetUrl = new URL(href, window.location.origin);
      } catch {
        return;
      }

      if (targetUrl.origin !== currentUrl.origin) return;

      // Never intercept /admin links (outside public [locale] site)
      if (
        targetUrl.pathname === "/admin" ||
        targetUrl.pathname.startsWith("/admin/")
      ) {
        return;
      }

      if (
        targetUrl.pathname === currentUrl.pathname &&
        targetUrl.search === currentUrl.search
      ) {
        return;
      }

      if (targetUrl.pathname === currentUrl.pathname) {
        return;
      }

      // Parse locale prefix from the rendered <a href> so next-intl's router.push never double-prefixes
      let targetLocale: AppLocale = routing.defaultLocale;
      let strippedPath = targetUrl.pathname;
      for (const loc of routing.locales) {
        if (strippedPath === `/${loc}` || strippedPath.startsWith(`/${loc}/`)) {
          targetLocale = loc;
          strippedPath = strippedPath.slice(loc.length + 1) || "/";
          break;
        }
      }
      // Same-page locale switch: skip wordmark cover/reveal (handled by subtle fade + ScrollTrigger refresh)
      let currentStripped = currentUrl.pathname;
      for (const loc of routing.locales) {
        if (
          currentStripped === `/${loc}` ||
          currentStripped.startsWith(`/${loc}/`)
        ) {
          currentStripped = currentStripped.slice(loc.length + 1) || "/";
          break;
        }
      }
      if (strippedPath === currentStripped && targetLocale !== locale) {
        return;
      }

      const nextDest = {
        pathname: `${strippedPath}${targetUrl.search}${targetUrl.hash}`,
        locale: targetLocale,
      };

      // Save current scroll position for Back restoration
      saveScrollPosition(
        currentUrl.pathname + currentUrl.search,
        window.scrollY
      );
      setNavigationKind("push");

      if (prefersReducedMotion) {
        return;
      }

      e.preventDefault();

      const overlay = overlayRef.current;
      const content = contentRef.current;
      if (!overlay) {
        router.push(nextDest.pathname, { locale: nextDest.locale });
        return;
      }

      // Rapid navigation: kill any running timeline & watchdog, never stack two covers
      clearWatchdog();
      activeTlRef.current?.kill();
      pendingDestRef.current = nextDest;

      const currentPhase = getTransitionSnapshot().state;
      const alreadyCovered = currentPhase === "waiting";

      getLenis()?.stop?.();
      setTransitionPhase("covering");
      gsap.set(overlay, { pointerEvents: "auto" });

      const pushAndArmWatchdog = () => {
        const dest = pendingDestRef.current;
        if (!dest) return;
        setTransitionPhase("waiting");

        clearWatchdog();
        watchdogRef.current = window.setTimeout(() => {
          const st = getTransitionSnapshot().state;
          if (st === "waiting" || st === "covering") {
            playReveal(
              window.location.pathname + window.location.search,
              window.location.pathname
            );
          }
        }, WATCHDOG_MS);

        router.push(dest.pathname, { locale: dest.locale, scroll: false });
      };

      if (alreadyCovered) {
        pushAndArmWatchdog();
        return;
      }

      const tl = gsap.timeline({
        onComplete: pushAndArmWatchdog,
      });
      activeTlRef.current = tl;

      tl.fromTo(
        overlay,
        { clipPath: "polygon(0% 100%, 100% 100%, 100% 100%, 0% 100%)" },
        {
          clipPath: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)",
          duration: isCompactViewport()
            ? COVER_DURATION_MOBILE
            : COVER_DURATION_DESKTOP,
          ease: "power3.inOut",
        }
      );

      if (content) {
        tl.fromTo(
          content,
          { opacity: 0, y: 14, scale: 0.96 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.3,
            ease: "power3.out",
          },
          "-=0.22"
        );
      }
    };

    document.addEventListener("click", handleDocumentClick, { capture: true });
    return () => {
      document.removeEventListener("click", handleDocumentClick, {
        capture: true,
      });
    };
  }, [router, locale, prefersReducedMotion, clearWatchdog, playReveal]);

  if (prefersReducedMotion) {
    return null;
  }

  return (
    <div
      ref={overlayRef}
      aria-hidden="true"
      data-transition-phase={transitionPhase}
      className="page-transition-cover fixed inset-0 z-50 flex items-center justify-center bg-navy-950 text-ivory pointer-events-none"
      style={{
        clipPath: "polygon(0% 100%, 100% 100%, 100% 100%, 0% 100%)",
      }}
    >
      <div
        ref={contentRef}
        className="flex flex-col items-center justify-center text-center opacity-0 select-none px-6"
      >
        <span
          dir="ltr"
          className="wordmark text-2xl sm:text-3xl lg:text-4xl font-semibold text-ivory"
        >
          W Automobiles
        </span>
        <div className="my-3 h-[2px] w-12 bg-brand-red rounded-full" />
        <span className="text-[11px] sm:text-xs font-medium tracking-[0.2em] text-silver uppercase">
          {tCommon("locationShort")}
        </span>
      </div>
    </div>
  );
}
