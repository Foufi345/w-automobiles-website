"use client";

/**
 * Shared iOS Safari-safe scroll lock utility for modals, drawers, menus, and lightboxes.
 * - Uses reference counting so nested overlays don't prematurely unlock.
 * - Stops/starts Lenis on the public site without importing Lenis (keeps /admin Lenis-free).
 * - Preserves and restores exact scroll position on iOS Safari.
 */

let lockCount = 0;
let savedScrollY = 0;

interface LenisLike {
  stop?: () => void;
  start?: () => void;
}

function getLenis(): LenisLike | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { __lenis?: LenisLike }).__lenis;
}

export function lockBodyScroll(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  lockCount += 1;
  if (lockCount > 1) return;

  savedScrollY = window.scrollY;
  getLenis()?.stop?.();

  const body = document.body;
  const html = document.documentElement;
  body.style.position = "fixed";
  body.style.top = `-${savedScrollY}px`;
  body.style.insetInlineStart = "0";
  body.style.insetInlineEnd = "0";
  body.style.width = "100%";
  body.style.overflow = "hidden";
  html.style.overscrollBehavior = "none";
}

export function unlockBodyScroll(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (lockCount === 0) return;

  lockCount -= 1;
  if (lockCount > 0) return;

  const body = document.body;
  const html = document.documentElement;
  body.style.position = "";
  body.style.top = "";
  body.style.insetInlineStart = "";
  body.style.insetInlineEnd = "";
  body.style.width = "";
  body.style.overflow = "";
  html.style.overscrollBehavior = "";

  window.scrollTo({ top: savedScrollY, left: 0, behavior: "instant" });
  getLenis()?.start?.();
}
