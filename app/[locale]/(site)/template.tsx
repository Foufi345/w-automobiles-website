"use client";

import { useLayoutEffect, useEffect } from "react";
import { usePathname } from "@/i18n/navigation";
import { signalPageReady } from "@/lib/transition";

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Next.js App Router template: remounts on every route change.
 * Signals "pageReady" in useLayoutEffect once the new route's DOM has mounted,
 * allowing PageTransition to refresh ScrollTrigger, restore scroll, and reveal.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useIsomorphicLayoutEffect(() => {
    signalPageReady(pathname);
  }, [pathname]);

  return <>{children}</>;
}
