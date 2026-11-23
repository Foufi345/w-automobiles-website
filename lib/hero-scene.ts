import generated from "./hero-scene.generated.json";

export interface SceneBox {
  /** Center X in percentage of the .scene container */
  cx: number;
  /** Center Y in percentage of the .scene container */
  cy: number;
  /** Width in percentage of the .scene container */
  width: number;
  /** Height in percentage of the .scene container */
  height: number;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface HeroSceneConfig {
  /** Combined car + floor scene aspect ratio */
  aspectRatio: string;
  aspectRatioNumber: number;
  /** Fraction of scene height occupied by the car cutout (0.72 = 72% car, 28% floor below) */
  carHeightFrac: number;
  carSrc: string;
  carWidth: number;
  carHeight: number;
  carBoundingBox: {
    xStart: number;
    xEnd: number;
    yStart: number;
    yEnd: number;
    centerY: number;
  };
  roofY: number;
  bodyBottomY: number;
  lowestY: number;
  horizonY: number;
  frontTireContacts: {
    left: Point2D;
    right: Point2D;
  };
  headlights: {
    left: SceneBox;
    right: SceneBox;
  };
  lightOrigin: Point2D;
  floorArea: {
    yStart: number;
    yEnd: number;
  };
}

const cutout = generated.cutout;
const CAR_HEIGHT_FRAC = 1.0;
const carAR = cutout.aspectRatioNumber;
const sceneAR = Number((carAR * CAR_HEIGHT_FRAC).toFixed(4));

const toSceneY = (carYPct: number) => Number((carYPct * CAR_HEIGHT_FRAC).toFixed(2));

/**
 * Single source of truth for the grounded Showroom Stage hero geometry.
 * Every coordinate is derived mathematically from /lib/hero-scene.generated.json (measured from alpha & bright blobs).
 */
export const HERO_SCENE: HeroSceneConfig = {
  aspectRatio: `${Math.round(sceneAR * 1000)} / 1000`,
  aspectRatioNumber: sceneAR,
  carHeightFrac: CAR_HEIGHT_FRAC,
  carSrc: "/hero/hero-car-cutout.webp",
  carWidth: cutout.width,
  carHeight: cutout.height,
  carBoundingBox: {
    xStart: cutout.carBounds.xStart,
    xEnd: cutout.carBounds.xEnd,
    yStart: toSceneY(cutout.carBounds.yStart),
    yEnd: toSceneY(cutout.carBounds.yEnd),
    centerY: toSceneY((cutout.carBounds.yStart + cutout.carBounds.yEnd) / 2),
  },
  roofY: toSceneY(cutout.roofY),
  bodyBottomY: toSceneY(cutout.bodyBottomY),
  lowestY: toSceneY(cutout.lowestY),
  horizonY: toSceneY(cutout.lowestY - 14),
  frontTireContacts: {
    left: {
      x: cutout.frontTireContacts.left.x,
      y: toSceneY(cutout.frontTireContacts.left.y),
    },
    right: {
      x: cutout.frontTireContacts.right.x,
      y: toSceneY(cutout.frontTireContacts.right.y),
    },
  },
  headlights: {
    left: {
      cx: cutout.headlights.left.cx,
      cy: toSceneY(cutout.headlights.left.cy),
      width: cutout.headlights.left.width,
      height: toSceneY(cutout.headlights.left.height),
    },
    right: {
      cx: cutout.headlights.right.cx,
      cy: toSceneY(cutout.headlights.right.cy),
      width: cutout.headlights.right.width,
      height: toSceneY(cutout.headlights.right.height),
    },
  },
  lightOrigin: {
    x: 50,
    y: toSceneY(50),
  },
  floorArea: {
    yStart: toSceneY(cutout.lowestY),
    yEnd: 100,
  },
};

export const HERO_ASSETS = generated;

export const HERO_IMAGE_SIZES =
  "(max-width: 767px) 86vw, (max-width: 1440px) 62vh, 772px";
