"use client";

import { useSyncExternalStore } from "react";
import { ScrollTrigger } from "@/lib/gsap";

export type TransitionPhase = "idle" | "covering" | "waiting" | "revealing";
export type NavigationKind = "push" | "pop";

export interface TransitionSnapshot {
  state: TransitionPhase;
  isTransitioning: boolean;
  canStartEntrance: boolean;
  readyPathname: string | null;
  readySeq: number;
  navigationKind: NavigationKind;
}

let snapshot: TransitionSnapshot = {
  state: "idle",
  isTransitioning: false,
  canStartEntrance: true,
  readyPathname: null,
  readySeq: 0,
  navigationKind: "push",
};

const listeners = new Set<() => void>();

// Saved scroll positions keyed by pathname + search for Back/Forward restoration
const savedScrollPositions = new Map<string, number>();

// Dev-only baseline ScrollTrigger counts per pathname to detect leaks
const devScrollTriggerBaselines = new Map<string, number>();

function emit() {
  listeners.forEach((l) => l());
}

export function setTransitionPhase(phase: TransitionPhase): void {
  const isTransitioning = phase !== "idle";
  const canStartEntrance = phase === "idle" || phase === "revealing";
  if (
    snapshot.state === phase &&
    snapshot.isTransitioning === isTransitioning &&
    snapshot.canStartEntrance === canStartEntrance
  ) {
    return;
  }
  snapshot = {
    ...snapshot,
    state: phase,
    isTransitioning,
    canStartEntrance,
  };
  emit();
}

export function setNavigationKind(kind: NavigationKind): void {
  if (snapshot.navigationKind === kind) return;
  snapshot = { ...snapshot, navigationKind: kind };
  emit();
}

/**
 * Called by app/template.tsx inside useLayoutEffect on every route mount
 * to signal that the new route's DOM has committed.
 */
export function signalPageReady(pathname: string): void {
  snapshot = {
    ...snapshot,
    readyPathname: pathname,
    readySeq: snapshot.readySeq + 1,
  };
  emit();
}

export function saveScrollPosition(key: string, y: number): void {
  savedScrollPositions.set(key, Math.max(0, Math.round(y)));
}

export function getSavedScrollPosition(key: string): number {
  return savedScrollPositions.get(key) ?? 0;
}

/**
 * Dev-only leak assertion: warns if ScrollTrigger.getAll().length increases
 * after returning to a previously visited route.
 */
export function assertScrollTriggerCountStable(pathname: string): void {
  if (process.env.NODE_ENV !== "development" || typeof window === "undefined") {
    return;
  }
  const currentCount = ScrollTrigger.getAll().length;
  const baseline = devScrollTriggerBaselines.get(pathname);
  if (baseline === undefined) {
    devScrollTriggerBaselines.set(pathname, currentCount);
  } else if (currentCount > baseline) {
    console.warn(
      `[ScrollTrigger Leak Check] Route "${pathname}" has ${currentCount} active ScrollTriggers (baseline was ${baseline}). Check useGSAP cleanup.`
    );
  }
}

export function getTransitionSnapshot(): TransitionSnapshot {
  return snapshot;
}

const SERVER_SNAPSHOT: TransitionSnapshot = {
  state: "idle",
  isTransitioning: false,
  canStartEntrance: true,
  readyPathname: null,
  readySeq: 0,
  navigationKind: "push",
};

function getServerSnapshot(): TransitionSnapshot {
  return SERVER_SNAPSHOT;
}

export function subscribeTransition(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Subscribe to the global route transition controller.
 * Pages wait for `canStartEntrance` (state === "idle" || state === "revealing")
 * before starting their own entrance animations.
 */
export function useTransitionState(): TransitionSnapshot {
  return useSyncExternalStore(
    subscribeTransition,
    getTransitionSnapshot,
    getServerSnapshot
  );
}
