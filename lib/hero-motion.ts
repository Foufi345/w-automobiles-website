export interface HeroTunnelWebGLConfig {
  /** Number of instanced ceiling/floor bars in WebGL (24) */
  barCount: number;
  /** Number of wall fins per wall in WebGL (12 pairs = 24 instances) */
  wallFinPairs: number;
  /** Camera vertical field of view in degrees */
  fov: number;
  /** Maximum DPR cap (1.5 normal desktop, 1.25 above 2560px width) */
  maxDpr: number;
  maxDprUltrawide: number;
  ultrawideWidthPx: number;
  /** Haze quad opacity (<= 0.12) and cycle duration (60s) */
  hazeOpacity: number;
  hazeCycleSeconds: number;
  hazeResolutionScale: number;
  /** Floor reflection opacity (0.20) */
  floorAlpha: number;
  /** Additive bloom sprite opacity around bar heads */
  bloomOpacity: number;
  /** Quality governor settings (30-frame rolling window, 22ms threshold, 0.6s cross-fade) */
  governor: {
    sampleFrames: number;
    thresholdMs: number;
    crossFadeSeconds: number;
  };
  /** requestIdleCallback timeout (600ms) after first paint */
  idleLoadTimeoutMs: number;
}

export interface HeroTunnelConfig {
  /** Seamless loop duration in seconds (translateZ(0) -> translateZ(barSpacing)) */
  duration: {
    desktop: number;
    mobile: number;
  };
  /** Depth spacing D between consecutive bars in CSS px */
  barSpacing: number;
  /** Number of ceiling + floor bar pairs in CSS tunnel */
  barCount: {
    desktop: number;
    mobile: number;
  };
  /** Opacity tunables for tunnel elements */
  opacity: {
    ceilingBarDesktop: number;
    ceilingBarMobile: number;
    redBar: number;
    ceilingGlow: number;
    floorMirrorBar: number;
    sideRail: number;
    wallFin: number;
  };
  /** Every Nth bar uses brand red (#C8102E) */
  redEvery: number;
  /** Intro playbackRate ramp (0.15 -> 1.0 over 3.0s, power2.out) and fade-in */
  intro: {
    initialPlaybackRate: number;
    rampDuration: number;
    rampEase: string;
    fadeInDuration: number;
    enterFromZ: number;
  };
  /** 3D corridor geometry in CSS px */
  geometry: {
    perspectivePx: number;
    halfWidthPx: number;
    ceilingOffsetY: number;
    sideRailOffsetY: number;
    barWidthPx: number;
    barDepthPx: number;
    glowDepthPx: number;
    firstBarZ: number;
  };
  /** WebGL-specific upgrade tunables for capable desktops */
  webgl: HeroTunnelWebGLConfig;
}

export interface HeroMotionConfig {
  /** One-time car approach & ground/text reveal duration in seconds */
  introDuration: {
    desktop: number;
    mobile: number;
  };
  /** Gentle endless headlight glow + floor light pool pulse */
  headlightLoop: {
    minOpacity: number;
    maxOpacity: number;
    duration: number;
    ease: string;
    repeat: number;
    rightOffset: number;
  };
  /** 3D Showroom Light Tunnel background configuration (shared by CSS and WebGL) */
  tunnel: HeroTunnelConfig;
}

/**
 * Central config for the grounded Showroom Stage hero motion:
 * 1) One-time intro (3.0s desktop, 2.4s mobile): .car-group approaches from z -900 -> 0 with
 *    synchronized contact-shadow tightening, reflection fade-in (+0.3s), headlight & floor light-pool
 *    ignition at 1.35s, floor fade-in over 1.5s..2.8s, and SplitText reveal.
 * 2) Gentle headlight glow + floor light-pool opacity pulse (0.8 <-> 1.0 over 3.2s, right offset 0.5s).
 * 3) Showroom Light Tunnel background (CSS fallback + WebGL upgrade on capable desktops).
 */
export const HERO_MOTION: HeroMotionConfig = {
  introDuration: {
    desktop: 3.0,
    mobile: 2.4,
  },
  headlightLoop: {
    minOpacity: 0.8,
    maxOpacity: 1.0,
    duration: 3.2,
    ease: "sine.inOut",
    repeat: -1,
    rightOffset: 0.5,
  },
  tunnel: {
    duration: {
      desktop: 8.0,
      mobile: 11.0,
    },
    barSpacing: 420,
    barCount: {
      desktop: 9,
      mobile: 6,
    },
    opacity: {
      ceilingBarDesktop: 0.5,
      ceilingBarMobile: 0.4,
      redBar: 0.35,
      ceilingGlow: 0.12,
      floorMirrorBar: 0.16,
      sideRail: 0.22,
      wallFin: 0.08,
    },
    redEvery: 8,
    intro: {
      initialPlaybackRate: 0.15,
      rampDuration: 3.0,
      rampEase: "power2.out",
      fadeInDuration: 1.5,
      enterFromZ: -600,
    },
    geometry: {
      perspectivePx: 900,
      halfWidthPx: 900,
      ceilingOffsetY: -360,
      sideRailOffsetY: -80,
      barWidthPx: 1800,
      barDepthPx: 6,
      glowDepthPx: 64,
      firstBarZ: 240,
    },
    webgl: {
      barCount: 24,
      wallFinPairs: 12,
      fov: 38,
      maxDpr: 1.5,
      maxDprUltrawide: 1.25,
      ultrawideWidthPx: 2560,
      hazeOpacity: 0.11,
      hazeCycleSeconds: 60,
      hazeResolutionScale: 0.6,
      floorAlpha: 0.2,
      bloomOpacity: 0.16,
      governor: {
        sampleFrames: 30,
        thresholdMs: 22,
        crossFadeSeconds: 0.6,
      },
      idleLoadTimeoutMs: 600,
    },
  },
};
