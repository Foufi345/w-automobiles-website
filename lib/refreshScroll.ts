"use client";

import { ScrollTrigger } from "@/lib/gsap";

let refreshTimer: number | null = null;

/**
 * Debounced ScrollTrigger.refresh() (150ms) so fonts, images, resizes,
 * orientation changes, and route transitions never trigger redundant layout thrashing.
 */
export function scheduleScrollRefresh(delayMs = 150): void {
  if (typeof window === "undefined") return;
  if (refreshTimer !== null) {
    window.clearTimeout(refreshTimer);
  }
  refreshTimer = window.setTimeout(() => {
    refreshTimer = null;
    ScrollTrigger.refresh();
  }, delayMs);
}

export function cancelScrollRefresh(): void {
  if (refreshTimer !== null) {
    window.clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

/**
 * Helper for once:true reveal timelines: if ScrollTrigger refreshes and the
 * scroll position is already past `st.start` (e.g. fast scrollbar drag, End key,
 * or browser scroll restoration), snap the timeline immediately to its final state.
 */
export function completeIfPastStart(
  tl: gsap.core.Animation,
  st: ScrollTrigger
): void {
  if (typeof window === "undefined") return;
  if (st.progress > 0 || window.scrollY >= st.start) {
    tl.progress(1);
  }
}
