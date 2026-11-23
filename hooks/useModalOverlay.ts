"use client";

import { useEffect, useRef, type RefObject } from "react";
import { lockBodyScroll, unlockBodyScroll } from "@/lib/mobile/scrollLock";

const FOCUSABLE_SELECTOR = [
  'a[href]:not([tabindex="-1"])',
  'button:not([disabled]):not([tabindex="-1"])',
  'input:not([disabled]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  '[tabindex]:not([tabindex="-1"])',
].join(",");

interface UseModalOverlayOptions {
  open: boolean;
  containerRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  /** Push a lightweight history entry so the mobile Back button closes the overlay. */
  closeOnBack?: boolean;
}

/**
 * Shared accessibility & mobile ergonomics hook for drawers, modals, and lightboxes:
 * - iOS-safe body scroll lock + Lenis pause/resume
 * - Focus trap inside containerRef & focus restoration on close
 * - Escape key dismissal
 * - Browser Back button dismissal
 */
export function useModalOverlay({
  open,
  containerRef,
  onClose,
  closeOnBack = true,
}: UseModalOverlayOptions): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const pushedHistoryRef = useRef(false);

  useEffect(() => {
    if (!open || typeof window === "undefined") return;

    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    lockBodyScroll();

    // Move focus into the overlay
    const container = containerRef.current;
    if (container) {
      const firstFocusable =
        container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      firstFocusable?.focus({ preventScroll: true });
    }

    // History state for mobile Back button dismissal
    if (closeOnBack) {
      try {
        window.history.pushState(
          { ...(window.history.state ?? {}), __overlayOpen: true },
          ""
        );
        pushedHistoryRef.current = true;
      } catch {
        pushedHistoryRef.current = false;
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }

      if (e.key === "Tab" && containerRef.current) {
        const focusables = Array.from(
          containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        ).filter((el) => el.offsetParent !== null);

        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;

        if (e.shiftKey && (active === first || !containerRef.current.contains(active))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    const handlePopState = () => {
      if (pushedHistoryRef.current) {
        pushedHistoryRef.current = false;
        onCloseRef.current();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("popstate", handlePopState);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("popstate", handlePopState);
      unlockBodyScroll();

      if (pushedHistoryRef.current) {
        pushedHistoryRef.current = false;
        try {
          if (window.history.state?.__overlayOpen) {
            window.history.back();
          }
        } catch {
          // Ignore history errors
        }
      }

      previouslyFocusedRef.current?.focus?.({ preventScroll: true });
      previouslyFocusedRef.current = null;
    };
  }, [open, containerRef, closeOnBack]);
}
