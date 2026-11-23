"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Dev-only horizontal overflow detector.
 * Scans the DOM after mount, route changes, and resizes and logs any element
 * whose bounding box extends past the viewport width.
 */
export function OverflowDetector() {
  const pathname = usePathname();

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    const scan = () => {
      const vw = document.documentElement.clientWidth;
      const sw = document.documentElement.scrollWidth;
      if (sw <= vw) return;

      const offenders: Array<{ selector: string; overflowPx: number }> = [];
      const all = Array.from(document.querySelectorAll<HTMLElement>("body *"));

      for (const el of all) {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        if (rect.right > vw + 1 || rect.left < -1) {
          const idPart = el.id ? `#${el.id}` : "";
          const cls =
            typeof el.className === "string"
              ? el.className
                  .trim()
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((c: string) => `.${c}`)
                  .join("")
              : "";
          offenders.push({
            selector: `${el.tagName.toLowerCase()}${idPart}${cls}`,
            overflowPx: Math.round(Math.max(rect.right - vw, -rect.left)),
          });
          if (offenders.length >= 8) break;
        }
      }

      console.warn(
        `[OverflowDetector] Horizontal overflow on "${pathname}": scrollWidth=${sw} > clientWidth=${vw}`,
        offenders
      );
    };

    const timer = window.setTimeout(scan, 400);
    window.addEventListener("resize", scan, { passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", scan);
    };
  }, [pathname]);

  return null;
}
