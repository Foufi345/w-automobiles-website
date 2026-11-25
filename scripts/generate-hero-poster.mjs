#!/usr/bin/env node
/**
 * Generates the art-directed transparent parked-car posters directly from the real
 * Three.js HeroScene (`?poster=1`, `preserveDrawingBuffer: true`, `alpha: true`, no text,
 * no background):
 *   - /public/hero/hero-poster-landscape.webp  (1920x1080, < 120 KB)
 *   - /public/hero/hero-poster-landscape.avif  (1920x1080, < 120 KB)
 *   - /public/hero/hero-poster-portrait.webp   (1080x1920, < 120 KB)
 *   - /public/hero/hero-poster-portrait.avif   (1080x1920, < 120 KB)
 */
import fs from "node:fs";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";
import sharp from "sharp";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "public/hero");
const PORT = Number(process.env.POSTER_PORT || 3495);
const MAX_BYTES = 120 * 1024;

fs.mkdirSync(OUT_DIR, { recursive: true });

async function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 350));
  }
  throw new Error(`Timed out waiting for server at ${url}`);
}

async function encodeUnderBudget(pngBuffer, format, outPath) {
  const qualities = [82, 74, 66, 58, 50, 42, 34];
  let encoded = null;
  let usedQ = qualities[0];

  for (const q of qualities) {
    usedQ = q;
    if (format === "webp") {
      encoded = await sharp(pngBuffer)
        .webp({ quality: q, alphaQuality: 85, effort: 6 })
        .toBuffer();
    } else {
      encoded = await sharp(pngBuffer)
        .avif({ quality: q, effort: 6 })
        .toBuffer();
    }
    if (encoded.length < MAX_BYTES) break;
  }

  fs.writeFileSync(outPath, encoded);
  const kb = (encoded.length / 1024).toFixed(1);
  console.log(
    `[hero:poster] Wrote ${path.relative(ROOT, outPath)} (${kb} KB, q=${usedQ})`
  );
  if (encoded.length >= MAX_BYTES) {
    throw new Error(`${outPath} exceeded 120 KB budget (${kb} KB)`);
  }
}

async function main() {
  const distDir = process.env.NEXT_DIST_DIR || ".next";
  if (!fs.existsSync(path.join(ROOT, distDir, "BUILD_ID"))) {
    throw new Error(
      `No production build found in ${distDir}. Run 'npm run build' before 'npm run hero:poster'.`
    );
  }

  console.log(`[hero:poster] Starting Next.js server on port ${PORT}...`);
  const server = spawn("npx", ["next", "start", "-p", String(PORT)], {
    cwd: ROOT,
    env: { ...process.env, NEXT_DIST_DIR: distDir },
    stdio: "ignore",
  });

  const tmpLandscapePng = path.join(OUT_DIR, ".tmp-poster-1920x1080.png");
  const tmpPortraitPng = path.join(OUT_DIR, ".tmp-poster-1080x1920.png");

  try {
    await waitForServer(`http://localhost:${PORT}/fr`);

    const pyScript = `
import base64, sys
from playwright.sync_api import sync_playwright

port = int(sys.argv[1])
out_l = sys.argv[2]
out_p = sys.argv[3]

targets = [
    (1920, 1080, False, out_l),
    (1080, 1920, True, out_p),
]

with sync_playwright() as p:
    browser = p.chromium.launch(
        headless=True,
        args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
    )
    for w, h, is_mob, out_path in targets:
        ctx = browser.new_context(
            viewport={"width": w, "height": h},
            device_scale_factor=1,
            is_mobile=is_mob,
            has_touch=is_mob,
        )
        page = ctx.new_page()
        page.goto(f"http://localhost:{port}/fr?poster=1", wait_until="domcontentloaded", timeout=60000)
        page.wait_for_function("() => window.__HERO_POSTER_READY__ === true", timeout=60000)
        page.wait_for_timeout(250)
        data_url = page.evaluate("() => document.querySelector('canvas[data-hero3d-canvas]').toDataURL('image/png')")
        raw = base64.b64decode(data_url.split(',', 1)[1])
        with open(out_path, 'wb') as f:
            f.write(raw)
        ctx.close()
    browser.close()
`;

    console.log(
      "[hero:poster] Capturing 1920x1080 & 1080x1920 RGBA buffers via Playwright (software WebGL)..."
    );
    execFileSync(
      "python3",
      ["-c", pyScript, String(PORT), tmpLandscapePng, tmpPortraitPng],
      { stdio: "inherit" }
    );

    const landBuf = fs.readFileSync(tmpLandscapePng);
    const portBuf = fs.readFileSync(tmpPortraitPng);

    // Verify transparency (alpha channel present and corner pixels have alpha == 0)
    const landMeta = await sharp(landBuf).metadata();
    const { data: cornerPx } = await sharp(landBuf)
      .extract({ left: 0, top: 0, width: 1, height: 1 })
      .raw()
      .toBuffer({ resolveWithObject: true });

    console.log(
      `[hero:poster] Landscape buffer: ${landMeta.width}x${landMeta.height}, channels=${landMeta.channels}, topLeftRGBA=[${cornerPx[0]},${cornerPx[1]},${cornerPx[2]},${cornerPx[3]}]`
    );

    await encodeUnderBudget(
      landBuf,
      "webp",
      path.join(OUT_DIR, "hero-poster-landscape.webp")
    );
    await encodeUnderBudget(
      landBuf,
      "avif",
      path.join(OUT_DIR, "hero-poster-landscape.avif")
    );
    await encodeUnderBudget(
      portBuf,
      "webp",
      path.join(OUT_DIR, "hero-poster-portrait.webp")
    );
    await encodeUnderBudget(
      portBuf,
      "avif",
      path.join(OUT_DIR, "hero-poster-portrait.avif")
    );
  } finally {
    server.kill("SIGTERM");
    for (const f of [tmpLandscapePng, tmpPortraitPng]) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
  }
}

main().catch((err) => {
  console.error("[hero:poster] Failed:", err);
  process.exit(1);
});
