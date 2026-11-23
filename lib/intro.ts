"use client";

import { useEffect, useSyncExternalStore } from "react";
import { gsap } from "@/lib/gsap";

export type IntroState = "idle" | "loading" | "exiting" | "done";

export interface IntroSnapshot {
  state: IntroState;
  isSkipped: boolean;
  forcedByWatchdog: boolean;
}

const SESSION_KEY = "w_preloader_seen";
const WATCHDOG_TIMEOUT_MS = 3000;

let currentSnapshot: IntroSnapshot = {
  state: "idle",
  isSkipped: false,
  forcedByWatchdog: false,
};

const listeners = new Set<() => void>();

let resolveReady: (() => void) | null = null;
let readyPromise: Promise<void> = new Promise<void>((resolve) => {
  resolveReady = resolve;
});

let watchdogTimer: ReturnType<typeof setTimeout> | null = null;
let initialized = false;

function emit() {
  listeners.forEach((listener) => listener());
}

function safeGetSeen(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function safeSetSeen(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    // Ignore storage errors (private browsing / restricted storage)
  }
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function unlockLenis(): void {
  if (typeof window === "undefined") return;
  const lenis = (
    window as unknown as { __lenis?: { start?: () => void } }
  ).__lenis;
  lenis?.start?.();
}

export function lockLenis(): void {
  if (typeof window === "undefined") return;
  const lenis = (
    window as unknown as { __lenis?: { stop?: () => void } }
  ).__lenis;
  lenis?.stop?.();
}

function clearWatchdog(): void {
  if (watchdogTimer !== null) {
    clearTimeout(watchdogTimer);
    watchdogTimer = null;
  }
}

function updateSnapshot(next: IntroSnapshot): void {
  if (
    currentSnapshot.state === next.state &&
    currentSnapshot.isSkipped === next.isSkipped &&
    currentSnapshot.forcedByWatchdog === next.forcedByWatchdog
  ) {
    return;
  }
  currentSnapshot = next;
  if (next.state === "done") {
    clearWatchdog();
    unlockLenis();
    if (resolveReady) {
      resolveReady();
      resolveReady = null;
    }
  }
  emit();
}

/**
 * Mark the document as animation-capable once JS motion is confirmed to run.
 * Without `html.js-anim`, all elements remain fully visible in CSS/HTML.
 */
export function enableJsAnimClass(): void {
  if (typeof document === "undefined") return;
  if (!prefersReducedMotion()) {
    document.documentElement.classList.add("js-anim");
  } else {
    document.documentElement.classList.remove("js-anim");
  }
}

/**
 * Starts the intro orchestrator on first client mount (idempotent).
 * Decides immediately whether to show the preloader or jump straight to "done".
 */
export function initIntro(): void {
  if (typeof window === "undefined") return;
  if (initialized) return;
  initialized = true;

  enableJsAnimClass();

  const isCompactMobile = window.innerWidth < 768;

  if (prefersReducedMotion() || safeGetSeen() || isCompactMobile) {
    if (isCompactMobile) safeSetSeen();
    updateSnapshot({
      state: "done",
      isSkipped: false,
      forcedByWatchdog: false,
    });
    return;
  }

  // Global 4000ms fail-safe watchdog measured from navigation start
  const elapsedSinceNav =
    typeof performance !== "undefined" ? performance.now() : 0;
  const remainingWatchdog = WATCHDOG_TIMEOUT_MS - elapsedSinceNav;

  if (remainingWatchdog <= 300) {
    forceFinishIntro();
    return;
  }

  clearWatchdog();
  watchdogTimer = setTimeout(() => {
    if (currentSnapshot.state !== "done") {
      forceFinishIntro();
    }
  }, remainingWatchdog);

  updateSnapshot({
    state: "loading",
    isSkipped: false,
    forcedByWatchdog: false,
  });
}

export function startExitingIntro(skipped = false): void {
  if (currentSnapshot.state === "exiting" || currentSnapshot.state === "done") {
    return;
  }
  updateSnapshot({
    state: "exiting",
    isSkipped: skipped,
    forcedByWatchdog: false,
  });
}

export function completeIntro(): void {
  safeSetSeen();
  updateSnapshot({
    state: "done",
    isSkipped: currentSnapshot.isSkipped,
    forcedByWatchdog: currentSnapshot.forcedByWatchdog,
  });
}

/**
 * Global fail-safe: forces intro completion, removes preloader, unlocks Lenis,
 * and clears all inline styles on hero elements so H1 and CTAs are guaranteed visible.
 */
export function forceFinishIntro(): void {
  safeSetSeen();
  unlockLenis();

  if (typeof document !== "undefined") {
    const heroEls = document.querySelectorAll("[data-hero-reveal]");
    if (heroEls.length > 0) {
      gsap.killTweensOf(heroEls);
      gsap.set(heroEls, { clearProps: "all" });
    }
  }

  updateSnapshot({
    state: "done",
    isSkipped: true,
    forcedByWatchdog: true,
  });
}

export function getIntroSnapshot(): IntroSnapshot {
  return currentSnapshot;
}

export function getIntroReady(): Promise<void> {
  return readyPromise;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const SERVER_SNAPSHOT: IntroSnapshot = {
  state: "idle",
  isSkipped: false,
  forcedByWatchdog: false,
};

function getServerSnapshot(): IntroSnapshot {
  return SERVER_SNAPSHOT;
}

/**
 * React hook subscribed to the single intro state machine.
 */
export function useIntro() {
  const snapshot = useSyncExternalStore(
    subscribe,
    getIntroSnapshot,
    getServerSnapshot
  );

  useEffect(() => {
    initIntro();
  }, []);

  return {
    state: snapshot.state,
    isSkipped: snapshot.isSkipped,
    forcedByWatchdog: snapshot.forcedByWatchdog,
    ready: readyPromise,
  };
}
