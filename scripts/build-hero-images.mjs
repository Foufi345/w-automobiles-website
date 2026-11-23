#!/usr/bin/env node
/**
 * Build-time hero image pipeline (npm run hero:images)
 *
 * Reads public/hero/hero-car.png, prints real dimensions (warns if < 1600px),
 * generates AVIF (q62) & WebP (q72) variants at [640, 960, 1280, 1920, 2400]
 * capped at sourceWidth (never upscales), generates blurDataURL, measures
 * top/side/bottom edge colors, and writes lib/hero-scene.generated.json.
 */

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const SRC_PRIMARY = path.join(ROOT, "public/hero/hero-car.png");
const SRC_FALLBACK = path.join(ROOT, "public/images/hero-car.png");
const OUT_DIR = path.join(ROOT, "public/hero");
const GENERATED_JSON = path.join(ROOT, "lib/hero-scene.generated.json");

const TARGET_WIDTHS = [640, 960, 1280, 1920, 2400];
const AVIF_QUALITY = 62;
const WEBP_QUALITY = 72;

function rgbToHex(r, g, b) {
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return (
    "#" +
    [clamp(r), clamp(g), clamp(b)]
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")
  );
}

async function sampleRegionAverage(srcBuffer, extractOpts) {
  const { data, info } = await sharp(srcBuffer)
    .extract(extractOpts)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = info.width * info.height;
  if (pixels === 0) return "#07090d";
  let r = 0;
  let g = 0;
  let b = 0;
  for (let i = 0; i < data.length; i += 3) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
  }
  return rgbToHex(r / pixels, g / pixels, b / pixels);
}

async function detectHeadlightCenters(srcBuffer, width, height) {
  const { data } = await sharp(srcBuffer)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const scanSide = (xMinPct, xMaxPct) => {
    const x0 = Math.floor(width * xMinPct);
    const x1 = Math.floor(width * xMaxPct);
    const y0 = Math.floor(height * 0.64);
    const y1 = Math.floor(height * 0.78);

    let minX = width,
      maxX = 0,
      minY = height,
      maxY = 0;
    let sumX = 0,
      sumY = 0,
      count = 0;

    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const idx = (y * width + x) * 3;
        const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        if (lum >= 190) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          sumX += x;
          sumY += y;
          count++;
        }
      }
    }

    if (count === 0) return null;
    return {
      cx: Number(((sumX / count / width) * 100).toFixed(2)),
      cy: Number(((sumY / count / height) * 100).toFixed(2)),
      w: Number((((maxX - minX) / width) * 100).toFixed(2)),
      h: Number((((maxY - minY) / height) * 100).toFixed(2)),
    };
  };

  return {
    left: scanSide(0.15, 0.45),
    right: scanSide(0.55, 0.85),
  };
}

async function main() {
  const srcPath = fs.existsSync(SRC_PRIMARY) ? SRC_PRIMARY : null;

  if (!srcPath) {
    console.warn(
      "[hero:images] Source file public/hero/hero-car.png not found. Writing fallback manifest."
    );
    const fallbackManifest = {
      available: false,
      sourceWidth: 736,
      sourceHeight: 1104,
      widths: [],
      avifSrcSet: "",
      webpSrcSet: "",
      fallbackSrc: "",
      blurDataURL: "",
      edges: {
        top: "#050608",
        left: "#07090c",
        right: "#07090c",
        bottom: "#0b121a",
        average: "#080a0e",
      },
    };
    fs.writeFileSync(
      GENERATED_JSON,
      JSON.stringify(fallbackManifest, null, 2) + "\n",
      "utf8"
    );
    return;
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const srcBuffer = fs.readFileSync(srcPath);
  const meta = await sharp(srcBuffer).metadata();
  const sourceWidth = meta.width || 0;
  const sourceHeight = meta.height || 0;

  console.log(
    `[hero:images] Source: ${path.relative(ROOT, srcPath)} — ${sourceWidth}x${sourceHeight}px`
  );
  if (sourceWidth < 1600) {
    console.warn(
      `[hero:images] WARNING: Source width is ${sourceWidth}px (< 1600px). Desktop viewports will look soft. Replace public/hero/hero-car.png with a higher-res asset (>= 1600px wide) — not upscaling.`
    );
  }

  // Never upscale above sourceWidth; include native sourceWidth if smaller than largest target
  const widths = Array.from(
    new Set([
      ...TARGET_WIDTHS.filter((w) => w <= sourceWidth),
      ...(sourceWidth < Math.max(...TARGET_WIDTHS) ? [sourceWidth] : []),
    ])
  ).sort((a, b) => a - b);

  const avifEntries = [];
  const webpEntries = [];

  for (const w of widths) {
    const avifFile = `hero-car-${w}.avif`;
    const webpFile = `hero-car-${w}.webp`;
    const avifPath = path.join(OUT_DIR, avifFile);
    const webpPath = path.join(OUT_DIR, webpFile);

    await sharp(srcBuffer)
      .resize({ width: w, withoutEnlargement: true })
      .avif({ quality: AVIF_QUALITY, effort: 6 })
      .toFile(avifPath);

    await sharp(srcBuffer)
      .resize({ width: w, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY, effort: 5 })
      .toFile(webpPath);

    const avifKb = (fs.statSync(avifPath).size / 1024).toFixed(1);
    const webpKb = (fs.statSync(webpPath).size / 1024).toFixed(1);
    console.log(
      `  -> ${w}w: ${avifFile} (${avifKb} KB), ${webpFile} (${webpKb} KB)`
    );

    if (w <= 960 && Number(avifKb) > 95) {
      console.warn(`  [WARN] ${avifFile} exceeds 95 KB budget (${avifKb} KB)`);
    }
    if (w <= 2400 && Number(avifKb) > 230) {
      console.warn(`  [WARN] ${avifFile} exceeds 230 KB budget (${avifKb} KB)`);
    }

    avifEntries.push(`/hero/${avifFile} ${w}w`);
    webpEntries.push(`/hero/${webpFile} ${w}w`);
  }

  // Tiny blurDataURL
  const blurBuf = await sharp(srcBuffer)
    .resize({ width: 16, height: 24, fit: "cover" })
    .webp({ quality: 40 })
    .toBuffer();
  const blurDataURL = `data:image/webp;base64,${blurBuf.toString("base64")}`;

  // Measure edge colors (4% strips along top, left, right, bottom)
  const stripH = Math.max(4, Math.round(sourceHeight * 0.04));
  const stripW = Math.max(4, Math.round(sourceWidth * 0.04));

  const [topColor, bottomColor, leftColor, rightColor] = await Promise.all([
    sampleRegionAverage(srcBuffer, {
      left: 0,
      top: 0,
      width: sourceWidth,
      height: stripH,
    }),
    sampleRegionAverage(srcBuffer, {
      left: 0,
      top: sourceHeight - stripH,
      width: sourceWidth,
      height: stripH,
    }),
    sampleRegionAverage(srcBuffer, {
      left: 0,
      top: 0,
      width: stripW,
      height: sourceHeight,
    }),
    sampleRegionAverage(srcBuffer, {
      left: sourceWidth - stripW,
      top: 0,
      width: stripW,
      height: sourceHeight,
    }),
  ]);

  const hexToRgb = (hex) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  const edgeRgbs = [topColor, bottomColor, leftColor, rightColor].map(hexToRgb);
  const averageColor = rgbToHex(
    edgeRgbs.reduce((s, c) => s + c[0], 0) / edgeRgbs.length,
    edgeRgbs.reduce((s, c) => s + c[1], 0) / edgeRgbs.length,
    edgeRgbs.reduce((s, c) => s + c[2], 0) / edgeRgbs.length
  );

  const detectedHeadlights = await detectHeadlightCenters(
    srcBuffer,
    sourceWidth,
    sourceHeight
  );
  console.log(
    `[hero:images] Edge colors: top=${topColor} left=${leftColor} right=${rightColor} bottom=${bottomColor} average=${averageColor}`
  );
  console.log(
    `[hero:images] Measured bright headlight clusters:`,
    JSON.stringify(detectedHeadlights)
  );

  let existingCutout = undefined;
  if (fs.existsSync(GENERATED_JSON)) {
    try {
      const prev = JSON.parse(fs.readFileSync(GENERATED_JSON, "utf8"));
      if (prev && prev.cutout) existingCutout = prev.cutout;
    } catch {
      // ignore
    }
  }

  const hasAlpha = Boolean(meta.hasAlpha);
  const largestW = widths[widths.length - 1];
  const manifest = {
    available: true,
    hasAlpha,
    sourceWidth,
    sourceHeight,
    widths,
    avifSrcSet: avifEntries.join(", "),
    webpSrcSet: webpEntries.join(", "),
    fallbackSrc: `/hero/hero-car-${largestW}.webp`,
    blurDataURL: hasAlpha ? "" : blurDataURL,
    edges: hasAlpha
      ? {
          top: "#0b121a",
          left: "#0b121a",
          right: "#0b121a",
          bottom: "#0b121a",
          average: "#0b121a",
        }
      : {
          top: topColor,
          left: leftColor,
          right: rightColor,
          bottom: bottomColor,
          average: averageColor,
        },
    ...(existingCutout ? { cutout: existingCutout } : {}),
  };

  fs.writeFileSync(
    GENERATED_JSON,
    JSON.stringify(manifest, null, 2) + "\n",
    "utf8"
  );
  console.log(`[hero:images] Wrote ${path.relative(ROOT, GENERATED_JSON)}`);
}

main().catch((err) => {
  console.error("[hero:images] Failed:", err);
  process.exit(1);
});
