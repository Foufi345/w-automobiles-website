"use client";

import { useEffect, useState } from "react";
import { usePathname } from "@/i18n/navigation";
import { ScrollTrigger } from "@/lib/gsap";
import { getIntroSnapshot } from "@/lib/intro";
import { getTransitionSnapshot } from "@/lib/transition";

interface DebugStats {
  scrollTriggers: number;
  pinnedTriggers: number;
  lenisScroll: string;
  windowScrollY: number;
  preloaderState: string;
  routeTransitionState: string;
  pathname: string;
}

/**
 * Temporary dev-only diagnostic overlay (activated via ?debug=1).
 * Never included in production builds (gated by process.env.NODE_ENV === "development").
 */
export function MotionDebugOverlay() {
  const pathname = usePathname();
  const [enabled, setEnabled] = useState(false);
  const [stats, setStats] = useState<DebugStats>({
    scrollTriggers: 0,
    pinnedTriggers: 0,
    lenisScroll: "n/a",
    windowScrollY: 0,
    preloaderState: "unknown",
    routeTransitionState: "idle",
    pathname: "/",
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("debug") === "1") {
      setEnabled(true);
    } else if (params.get("debug") === "0") {
      setEnabled(false);
    }
  }, [pathname]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const sample = () => {
      const allTriggers = ScrollTrigger.getAll();
      const pinnedCount = allTriggers.filter((st) => Boolean(st.pin)).length;

      const win = window as unknown as {
        __lenis?: { scroll?: number; isStopped?: boolean };
      };

      const lenis = win.__lenis;
      const lenisScroll =
        lenis && typeof lenis.scroll === "number"
          ? `${Math.round(lenis.scroll)}px${lenis.isStopped ? " (stopped)" : ""}`
          : "inactive";

      const intro = getIntroSnapshot();
      let seenFlag: string | null = null;
      try {
        seenFlag = sessionStorage.getItem("w_preloader_seen");
      } catch {
        seenFlag = "err";
      }
      const preloaderState = `${intro.state} (skip=${intro.isSkipped}, wd=${intro.forcedByWatchdog}, seen=${seenFlag ?? "null"})`;

      const transition = getTransitionSnapshot();
      const routeTransitionState = `${transition.state} (${transition.navigationKind})`;

      setStats({
        scrollTriggers: allTriggers.length,
        pinnedTriggers: pinnedCount,
        lenisScroll,
        windowScrollY: Math.round(window.scrollY),
        preloaderState,
        routeTransitionState,
        pathname,
      });
    };

    sample();
    const interval = window.setInterval(sample, 150);
    return () => window.clearInterval(interval);
  }, [enabled, pathname]);

  if (!enabled) return null;

  return (
    <aside
      aria-label="Motion debug overlay"
      className="fixed bottom-4 left-4 z-[9999] max-w-xs rounded-lg border border-brand-red/70 bg-navy-950/95 p-3 font-mono text-[11px] leading-relaxed text-ivory shadow-2xl backdrop-blur-md"
    >
      <div className="mb-1.5 flex items-center justify-between border-b border-navy-700 pb-1">
        <span className="font-semibold uppercase tracking-wider text-brand-red">
          Motion Debug (?debug=1)
        </span>
        <span className="text-[10px] text-silver">{stats.pathname}</span>
      </div>
      <dl className="space-y-0.5">
        <div className="flex justify-between gap-3">
          <dt className="text-silver">ScrollTriggers:</dt>
          <dd className="font-semibold text-ivory">
            {stats.scrollTriggers} ({stats.pinnedTriggers} pinned)
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-silver">Lenis scroll:</dt>
          <dd className="text-ivory">{stats.lenisScroll}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-silver">window.scrollY:</dt>
          <dd className="text-ivory">{stats.windowScrollY}px</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-silver">Preloader:</dt>
          <dd className="text-right text-ivory">{stats.preloaderState}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-silver">PageTransition:</dt>
          <dd className="text-right text-ivory">{stats.routeTransitionState}</dd>
        </div>
      </dl>
    </aside>
  );
}
