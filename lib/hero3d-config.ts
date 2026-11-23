export interface NeonPalettePreset {
  name: string;
  /** Primary neon accent color (hex) */
  primary: string;
  /** White-hot emissive core color (hex) */
  core: string;
  /** Subtle ambient fog tint (hex) */
  fogTint: string;
}

export const NEON_PALETTES = {
  electricBlue: {
    name: "ELECTRIC BLUE",
    primary: "#2F6BFF",
    core: "#BFD6FF",
    fogTint: "#0D1A33",
  },
  steel: {
    name: "STEEL",
    primary: "#9FB8D6",
    core: "#EAF2FF",
    fogTint: "#0E1622",
  },
} as const;

export type NeonPaletteKey = keyof typeof NEON_PALETTES;

export interface Hero3DConfig {
  /** Active neon palette preset ("electricBlue" | "steel") */
  activePalette: NeonPaletteKey;
  neon: NeonPalettePreset;
  /** Base scene background color */
  backgroundColor: string;
  /** Runtime PBR materials applied to the normalized 3D Audi GLB */
  materials: {
    paint: {
      color: string;
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
      depthWrite: boolean;
    };
    headlights: {
      color: string;
      emissive: string;
      emissiveIntensity: number;
      roughness: number;
    };
    drl: {
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
  /** Asset paths for desktop & mobile GLBs and self-hosted Draco decoder */
  assets: {
    desktopGlb: string;
    mobileGlb: string;
    dracoDecoderPath: string;
  };
  /** Device quality tier thresholds */
  tiers: {
    desktopMinWidth: number;
    desktopMinCores: number;
    desktopMinMemoryGB: number;
    maxDprDesktop: number;
    maxDprMobile: number;
  };
}

const ACTIVE_PALETTE: NeonPaletteKey = "electricBlue";
const activeNeon = NEON_PALETTES[ACTIVE_PALETTE];

/**
 * Single source of truth for the real-time 3D Audi Hero Scene & Materials.
 * No magic numbers in components.
 */
export const HERO3D_CONFIG: Hero3DConfig = {
  activePalette: ACTIVE_PALETTE,
  neon: activeNeon,
  backgroundColor: "#060A10",
  materials: {
    paint: {
      color: "#050608",
      metalness: 0.55,
      roughness: 0.3,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      envMapIntensity: 1.3,
    },
    tires: {
      color: "#0a0a0b",
      metalness: 0.08,
      roughness: 0.75,
    },
    rims: {
      color: "#1e2229",
      metalness: 0.82,
      roughness: 0.35,
      envMapIntensity: 1.25,
    },
    calipers: {
      color: "#C8102E",
      metalness: 0.25,
      roughness: 0.4,
      clearcoat: 0.6,
    },
    glass: {
      color: "#05070a",
      opacity: 0.35,
      roughness: 0.05,
      metalness: 0.1,
      envMapIntensity: 1.5,
      depthWrite: false,
    },
    headlights: {
      color: activeNeon.core,
      emissive: activeNeon.primary,
      emissiveIntensity: 3.4,
      roughness: 0.1,
    },
    drl: {
      color: activeNeon.core,
      emissive: activeNeon.core,
      emissiveIntensity: 4.8,
      roughness: 0.08,
    },
    taillights: {
      color: "#ff1a35",
      emissive: "#C8102E",
      emissiveIntensity: 2.2,
      roughness: 0.15,
    },
    interior: {
      color: "#050608",
      roughness: 0.88,
      metalness: 0.08,
    },
    trimDark: {
      color: "#080a0e",
      roughness: 0.45,
      metalness: 0.5,
    },
  },
  assets: {
    desktopGlb: "/models/hero-car.glb",
    mobileGlb: "/models/hero-car-lite.glb",
    dracoDecoderPath: "/draco/",
  },
  tiers: {
    desktopMinWidth: 1024,
    desktopMinCores: 6,
    desktopMinMemoryGB: 8,
    maxDprDesktop: 1.5,
    maxDprMobile: 1.25,
  },
};
