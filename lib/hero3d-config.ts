export type DrlMode = "static" | "off";

export interface Hero3DConfig {
  /** Pure CSS static dark navy textured background (exposed as CSS custom properties) */
  background: {
    edge: string;
    ring: string;
    center: string;
    outerRing: string;
    navy950: string;
    vignetteColor: string;
    offCenterPoolColor: string;
    grainOpacity: number;
    marblingColor: string;
    marblingOpacity: number;
  };
  /** Soft procedural 2D radial-gradient ground shadows under the car's heading group */
  groundShadow: {
    /** Multiplies all three shadow alphas (0 to 1, default 1; 0 disables shadows completely) */
    strength: number;
    tirePatches: {
      y: number;
      widthMultiplier: number;
      lengthM: number;
      peakAlpha: number;
      stops: Array<[number, number]>;
    };
    contact: {
      y: number;
      widthMultiplier: number;
      lengthMultiplier: number;
      peakAlpha: number;
      stops: Array<[number, number]>;
    };
    ambient: {
      y: number;
      widthMultiplier: number;
      lengthMultiplier: number;
      peakAlpha: number;
      stops: Array<[number, number]>;
    };
  };
  /** Studio car lighting (RoomEnvironment on scene.environment + key + cool rim + hemisphere; no shadow maps) */
  lighting: {
    envMapIntensity: number;
    keyLight: {
      color: string;
      intensity: number;
      position: [number, number, number];
    };
    rimLight: {
      color: string;
      intensity: number;
      position: [number, number, number];
    };
    hemiLight: {
      skyColor: string;
      groundColor: string;
      intensity: number;
    };
  };
  /** Renderer settings */
  renderer: {
    toneMappingExposure: number;
    maxDpr: number;
  };
  /** Exterior body paint & DRL settings */
  paintColor: string;
  drl: DrlMode;
  materials: {
    paint: {
      metalness: number;
      roughness: number;
      clearcoat: number;
      clearcoatRoughness: number;
      envMapIntensity: number;
    };
    tires: {
      color: string;
      metalness: number;
      roughness: number;
    };
    rims: {
      color: string;
      metalness: number;
      roughness: number;
      envMapIntensity: number;
    };
    calipers: {
      color: string;
      metalness: number;
      roughness: number;
      clearcoat: number;
    };
    glass: {
      color: string;
      opacity: number;
      roughness: number;
      metalness: number;
      envMapIntensity: number;
    };
    headlights: {
      color: string;
      emissive: string;
      emissiveIntensity: number;
      roughness: number;
    };
    drlLamp: {
      color: string;
      emissive: string;
      emissiveIntensity: number;
      roughness: number;
    };
    taillights: {
      color: string;
      emissive: string;
      emissiveIntensity: number;
      roughness: number;
    };
    interior: {
      color: string;
      roughness: number;
      metalness: number;
    };
    trimDark: {
      color: string;
      roughness: number;
      metalness: number;
    };
  };
  /** Fixed camera & DOM framing solver */
  camera: {
    position: [number, number, number];
    lookAt: [number, number, number];
    landscapeVerticalFovDeg: number;
    portraitMinHorizontalFovDeg: number;
    near: number;
    far: number;
  };
  framing: {
    minMarginPx: number;
    desktopMaxWidthRatio: number;
    mobileMaxWidthRatio: number;
    resizeDebounceMs: number;
    mobileBreakpointPx: number;
  };
  /** Deterministic arrival kinematics & damped body springs */
  arrival: {
    desktopDurationSec: number;
    mobileDurationSec: number;
    desktopTextRevealStartSec: number;
    mobileTextRevealStartSec: number;
    cruiseFraction: number;
    brakeOnsetSec: number;
    settleWindowSec: number;
    fixedTimeStepSec: number;
    pathControlPoints: Array<[number, number, number]>;
    targetFinalHeadingDeg: number;
    maxSteerRad: number;
    steerFilterTauSec: number;
    springOmega: number;
    springZeta: number;
    maxBrakingPitchDeg: number;
    maxCorneringRollDeg: number;
  };
  /** Loading, 1.0 s arrival canvas fade-in, 6 s abort timeout, frame-rate guard, and transparent posters */
  loading: {
    timeoutMs: number;
    canvasFadeInMs: number;
    frameGuardWindowSec: number;
    frameGuardMaxAvgMs: number;
    posterCrossfadeMs: number;
    desktopGlb: string;
    mobileGlb: string;
    dracoDecoderPath: string;
    posters: {
      landscapeAvif: string;
      landscapeWebp: string;
      portraitAvif: string;
      portraitWebp: string;
    };
  };
}

/**
 * Single source of truth for the Final 3D Audi Hero (CSS Navy Background + Grounded Transparent Car).
 */
export const HERO3D_CONFIG: Hero3DConfig = {
  background: {
    edge: "#0B131A",
    ring: "#15202C",
    center: "#1B2A3A",
    outerRing: "#0F1923",
    navy950: "#0B121A",
    vignetteColor: "rgba(5, 9, 14, 0.55)",
    offCenterPoolColor: "rgba(34, 52, 70, 0.30)",
    grainOpacity: 0.05,
    marblingColor: "#9FB8D6",
    marblingOpacity: 0.06,
  },
  groundShadow: {
    strength: 1.0,
    tirePatches: {
      y: 0.006,
      widthMultiplier: 1.5,
      lengthM: 0.45,
      peakAlpha: 0.9,
      stops: [
        [0, 1.0],
        [0.6, 0.6],
        [1, 0.0],
      ],
    },
    contact: {
      y: 0.004,
      widthMultiplier: 0.98,
      lengthMultiplier: 0.88,
      peakAlpha: 0.8,
      stops: [
        [0, 0.9],
        [0.55, 0.6],
        [0.82, 0.22],
        [1, 0.0],
      ],
    },
    ambient: {
      y: 0.003,
      widthMultiplier: 1.6,
      lengthMultiplier: 1.3,
      peakAlpha: 0.42,
      stops: [
        [0, 0.55],
        [0.5, 0.38],
        [1, 0.0],
      ],
    },
  },
  lighting: {
    envMapIntensity: 0.9,
    keyLight: {
      color: "#FFFFFF",
      intensity: 2.2,
      position: [-5.5, 7.5, 6.5],
    },
    rimLight: {
      color: "#9FB8D6",
      intensity: 1.4,
      position: [6.0, 5.2, -6.5],
    },
    hemiLight: {
      skyColor: "#B8CCE4",
      groundColor: "#0B121A",
      intensity: 0.35,
    },
  },
  renderer: {
    toneMappingExposure: 1.0,
    maxDpr: 1.5,
  },
  paintColor: "#0A0B0E",
  drl: "static",
  materials: {
    paint: {
      metalness: 0.45,
      roughness: 0.3,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      envMapIntensity: 0.9,
    },
    tires: {
      color: "#12151A",
      metalness: 0.08,
      roughness: 0.76,
    },
    rims: {
      color: "#6B7482",
      metalness: 0.86,
      roughness: 0.28,
      envMapIntensity: 0.9,
    },
    calipers: {
      color: "#C8102E",
      metalness: 0.25,
      roughness: 0.38,
      clearcoat: 0.6,
    },
    glass: {
      color: "#0D1520",
      opacity: 0.5,
      roughness: 0.05,
      metalness: 0.1,
      envMapIntensity: 0.9,
    },
    headlights: {
      color: "#DCE8FF",
      emissive: "#B8D0FF",
      emissiveIntensity: 1.05,
      roughness: 0.1,
    },
    drlLamp: {
      color: "#EEF4FF",
      emissive: "#D6E4FF",
      emissiveIntensity: 1.55,
      roughness: 0.08,
    },
    taillights: {
      color: "#C8102E",
      emissive: "#9E0B22",
      emissiveIntensity: 0.85,
      roughness: 0.15,
    },
    interior: {
      color: "#080B10",
      roughness: 0.88,
      metalness: 0.08,
    },
    trimDark: {
      color: "#141922",
      roughness: 0.42,
      metalness: 0.55,
    },
  },
  camera: {
    position: [0, 0.9, 7.8],
    lookAt: [0.1, 0.65, 0],
    landscapeVerticalFovDeg: 30,
    portraitMinHorizontalFovDeg: 46,
    near: 0.2,
    far: 100,
  },
  framing: {
    minMarginPx: 16,
    desktopMaxWidthRatio: 0.58,
    mobileMaxWidthRatio: 0.9,
    resizeDebounceMs: 100,
    mobileBreakpointPx: 1024,
  },
  arrival: {
    desktopDurationSec: 2.35,
    mobileDurationSec: 2.05,
    desktopTextRevealStartSec: 1.0,
    mobileTextRevealStartSec: 0.85,
    cruiseFraction: 0.18,
    brakeOnsetSec: 0.26,
    settleWindowSec: 0.4,
    fixedTimeStepSec: 1 / 120,
    pathControlPoints: [
      [-4.1, 0, -20.5],
      [-3.1, 0, -14.2],
      [-2.1, 0, -8.2],
      [-1.165, 0, -3.2],
      [0.0, 0, 0.0],
    ],
    targetFinalHeadingDeg: 20,
    maxSteerRad: 0.35,
    steerFilterTauSec: 0.12,
    springOmega: 9,
    springZeta: 0.55,
    maxBrakingPitchDeg: 0.84,
    maxCorneringRollDeg: 0.72,
  },
  loading: {
    timeoutMs: 6000,
    canvasFadeInMs: 1000,
    frameGuardWindowSec: 0.85,
    frameGuardMaxAvgMs: 33,
    posterCrossfadeMs: 300,
    desktopGlb: "/models/hero-car.glb",
    mobileGlb: "/models/hero-car-lite.glb",
    dracoDecoderPath: "/draco/",
    posters: {
      landscapeAvif: "/hero/hero-poster-landscape.avif",
      landscapeWebp: "/hero/hero-poster-landscape.webp",
      portraitAvif: "/hero/hero-poster-portrait.avif",
      portraitWebp: "/hero/hero-poster-portrait.webp",
    },
  },
};
