export type ArrivalPlayMode =
  | "play-once"
  | "continue-arrival"
  | "parked-return"
  | "poster-capture";

export interface ResolvedArrivalSession {
  mode: ArrivalPlayMode;
  initialTimeSec: number;
}

/**
 * In-memory page-lifetime state (resets automatically on every browser reload):
 * - Every full page load / reload (`Cmd+R` / `F5`) starts fresh and plays the arrival!
 * - Within the same SPA lifecycle, React Strict Mode double-mounting continues seamlessly
 *   from `moduleArrivalStartPerfMs`, and client-side route changes (`/vehicules` -> Back)
 *   or client-side language switches (`fr`/`en`/`ar`) keep the parked car without replaying.
 */
let moduleArrivalStartPerfMs: number | null = null;
let moduleArrivalCompleted = false;
const homeReplayListeners = new Set<() => void>();

/**
 * Resets arrival state and notifies any mounted HeroSection when the user clicks
 * a Home link in the navbar (either from another route or while already on `/`).
 */
export function triggerHeroReplayFromHomeNav(): void {
  moduleArrivalStartPerfMs = null;
  moduleArrivalCompleted = false;
  homeReplayListeners.forEach((listener) => listener());
}

/**
 * Subscribes to same-page navbar Home clicks so an already-mounted HeroSection replays cleanly.
 */
export function onHeroHomeNavReplay(listener: () => void): () => void {
  homeReplayListeners.add(listener);
  return () => {
    homeReplayListeners.delete(listener);
  };
}

/**
 * Synchronous check used at HeroSection mount to decide whether this is an in-app
 * client-side return visit (after already parking in the current SPA lifecycle).
 */
export function isHeroReturnVisit(): boolean {
  return moduleArrivalCompleted;
}

/**
 * Resolves the exact playback mode and starting `t` (seconds) when HeroScene finishes loading.
 */
export function resolveHeroArrivalSession(
  durationSec: number,
  options?: { posterMode?: boolean; explicitTimeSec?: number | null }
): ResolvedArrivalSession {
  if (options?.posterMode) {
    return { mode: "poster-capture", initialTimeSec: durationSec };
  }
  if (
    options?.explicitTimeSec !== undefined &&
    options?.explicitTimeSec !== null
  ) {
    return { mode: "poster-capture", initialTimeSec: options.explicitTimeSec };
  }

  if (moduleArrivalCompleted) {
    return { mode: "parked-return", initialTimeSec: durationSec };
  }

  if (moduleArrivalStartPerfMs !== null) {
    const elapsedSec = Math.max(
      0,
      (performance.now() - moduleArrivalStartPerfMs) / 1000
    );
    if (elapsedSec >= durationSec) {
      moduleArrivalCompleted = true;
      return { mode: "parked-return", initialTimeSec: durationSec };
    }
    return { mode: "continue-arrival", initialTimeSec: elapsedSec };
  }

  return { mode: "play-once", initialTimeSec: 0 };
}

/**
 * Called at the exact moment the arrival animation begins rendering at t = 0.
 */
export function notifyHeroArrivalStarted(): void {
  if (moduleArrivalStartPerfMs === null) {
    moduleArrivalStartPerfMs = performance.now();
  }
}

/**
 * Called when the arrival reaches `t = duration` (or jumps to parked via the frame-rate guard).
 */
export function notifyHeroArrivalCompleted(): void {
  moduleArrivalCompleted = true;
}

/**
 * Detects whether the current client device/browser should skip 3D and show the poster only:
 * - No WebGL context available
 * - `prefers-reduced-motion: reduce`
 * - `Save-Data` enabled
 * - `deviceMemory <= 2` (when exposed)
 */
export function detectCanRunHero3D(): {
  canRun3D: boolean;
  reason: string;
} {
  if (typeof window === "undefined") {
    return { canRun3D: false, reason: "ssr" };
  }

  const params = new URLSearchParams(window.location.search);
  if (params.get("poster") === "1") {
    return { canRun3D: true, reason: "poster-capture" };
  }
  if (params.get("webgl") === "0") {
    return { canRun3D: false, reason: "webgl-disabled-param" };
  }

  if (
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return { canRun3D: false, reason: "prefers-reduced-motion" };
  }

  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  if (nav.connection?.saveData) {
    return { canRun3D: false, reason: "save-data" };
  }
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory <= 2) {
    return { canRun3D: false, reason: "low-device-memory" };
  }

  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl");
    if (!gl) {
      return { canRun3D: false, reason: "no-webgl" };
    }
  } catch {
    return { canRun3D: false, reason: "webgl-error" };
  }

  return { canRun3D: true, reason: "capable" };
}
