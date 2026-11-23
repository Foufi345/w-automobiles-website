# Mobile Guidelines — W Automobiles

Short engineering reference for maintaining mobile-first usability, touch ergonomics, and RTL readiness across both the public site (`app/(site)`) and admin (`app/(admin)`).

---

## 1. Shared Primitives & Utilities

| Module | Purpose |
| :--- | :--- |
| `components/ui/TouchPrimitives.tsx` | `Button`, `IconButton`, `ActionLink` — enforces `min-h-[44px] min-w-[44px]`, `gap-2` (≥ 8px), `:focus-visible`, and brand variants (`primary`, `secondary`, `ghost`, `whatsapp`, `danger`). |
| `lib/mobile/scrollLock.ts` | Reference-counted `lockBodyScroll()` / `unlockBodyScroll()` safe on iOS Safari (preserves scroll position, pauses/resumes `window.__lenis` on the public site without importing Lenis into `/admin`). |
| `hooks/useModalOverlay.ts` | Shared overlay hook for drawers, modals, and lightboxes: scroll lock, focus trap + restoration, `Escape` dismissal, and mobile browser **Back** button dismissal. |
| `components/dev/OverflowDetector.tsx` | Dev-only helper (excluded from production) that logs any element wider than `documentElement.clientWidth`. |
| `tests/mobile-overflow.spec.ts` | Playwright assertion guaranteeing `scrollWidth <= clientWidth` at `320`, `360`, `390`, and `768` px. |

---

## 2. Core Rules

1. **Viewport & Theme**: `width=device-width, initial-scale=1, viewport-fit=cover` (never disable zoom), `themeColor: "#0B121A"`, `colorScheme: "dark"`.
2. **Viewport Heights**: Always use `100svh` (with `100vh` fallback via `.min-h-svh-safe` / `.h-svh-safe`); use `dvh` (`.h-dvh-safe`) only when a sheet/overlay should track collapsing browser bars. Never use raw `100vh`.
3. **Safe Areas**: Apply `.safe-pt`, `.safe-pb`, `.safe-px`, or `env(safe-area-inset-*)` on fixed headers, floating WhatsApp button, sticky mobile bottom bars, drawers, and toast hosts.
4. **Touch & Hover**:
   - Minimum `44×44 px` tap target, `≥ 8 px` (`gap-2`) between adjacent controls.
   - `touch-action: manipulation` globally on interactive elements.
   - Tailwind `future.hoverOnlyWhenSupported: true` + `@media (hover: hover) and (pointer: fine)` on custom hover CSS so touch devices never get sticky hover states.
5. **Forms**: Inputs, selects, and textareas use `≥ 16px` (`text-base` / coarse-pointer CSS rule) to prevent iOS Safari focus zoom. Always pair visible `<label>`, proper `type`/`inputMode`/`autoComplete`/`enterKeyHint`, and inline field-level error text.
6. **Logical Tailwind Only**: Use `ms-`/`me-`, `ps-`/`pe-`, `start-`/`end-`, `text-start`/`text-end`, `border-s`/`border-e`, `rounded-s`/`rounded-e` so Arabic RTL works cleanly.
7. **Overflow**: Never mask horizontal overflow with `overflow-x: hidden` on `body`. Fix the root cause with `min-w-0`, `flex-wrap`, and responsive grids.
8. **Images**: Always provide accurate `sizes` and explicit `aspect-ratio` containers; reserve `priority` strictly for the homepage hero image.
9. **Landscape Phones**: Drawers/menus use `overflow-y-auto overscroll-contain`; hero uses `.hero-viewport-fit` so it never exceeds viewport height on short landscape screens (`max-height: 500px`).
