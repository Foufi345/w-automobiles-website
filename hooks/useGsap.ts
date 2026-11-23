"use client";

import { useLayoutEffect, useEffect, useRef } from "react";
import { usePathname } from "@/i18n/navigation";
import { gsap } from "@/lib/gsap";
import { useReducedMotion } from "./useReducedMotion";

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

interface UseGsapOptions {
  scope?: React.RefObject<Element | null>;
  dependencies?: React.DependencyList;
  revertOnUpdate?: boolean;
}

/**
 * Scoped GSAP animation hook with automatic cleanup on unmount and route changes.
 * Wraps gsap.context() AND executes any cleanup function returned by the callback
 * (e.g., gsap.matchMedia().revert(), gsap.ticker.remove(), listener teardown).
 */
export function useGsap(
  animationCallback: (
    context: gsap.Context,
    isReducedMotion: boolean
  ) => void | (() => void),
  options: UseGsapOptions = {}
) {
  const { scope, dependencies = [] } = options;
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();
  const callbackRef = useRef(animationCallback);
  callbackRef.current = animationCallback;

  useIsomorphicLayoutEffect(() => {
    if (typeof window === "undefined") return;

    let userCleanup: void | (() => void);
    const ctx = gsap.context((self) => {
      userCleanup = callbackRef.current(self, prefersReducedMotion);
    }, scope?.current || undefined);

    return () => {
      if (typeof userCleanup === "function") {
        userCleanup();
      }
      ctx.revert();
    };
  }, [pathname, prefersReducedMotion, ...dependencies]);
}
