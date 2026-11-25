"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { getLocalizedSiteConfig, getWhatsAppUrl } from "@/lib/config";
import { HERO3D_CONFIG } from "@/lib/hero3d-config";
import {
  detectCanRunHero3D,
  isHeroReturnVisit,
  onHeroHomeNavReplay,
} from "@/lib/hero3d/session-state";
import type { HeroScene, FramingZoneRects } from "@/lib/hero3d/HeroScene";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";

const Hero3DCanvas = dynamic(() => import("@/components/hero/Hero3DCanvas"), {
  ssr: false,
});

function hexToNormRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const n = parseInt(clean, 16);
  return [
    Number(((n >> 16) & 255) / 255).valueOf(),
    Number(((n >> 8) & 255) / 255).valueOf(),
    Number((n & 255) / 255).valueOf(),
  ];
}

const [MARBLE_R, MARBLE_G, MARBLE_B] = hexToNormRgb(
  HERO3D_CONFIG.background.marblingColor
);

const MARBLING_SVG_DATA_URI = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="1400" viewBox="0 0 1400 1400"><filter id="m" x="0%" y="0%" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.006" numOctaves="3" stitchTiles="stitch" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 ${MARBLE_R.toFixed(4)} 0 0 0 0 ${MARBLE_G.toFixed(4)} 0 0 0 0 ${MARBLE_B.toFixed(4)} 1 0 0 0 0"/></filter><rect width="1400" height="1400" filter="url(#m)"/></svg>`
)}")`;

const GRAIN_SVG_DATA_URI = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><filter id="g" x="0%" y="0%" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" result="t"/><feColorMatrix in="t" type="saturate" values="0"/></filter><rect width="200" height="200" filter="url(#g)"/></svg>`
)}")`;

const HERO_BG_CSS_VARS: CSSProperties = {
  "--navy-950": HERO3D_CONFIG.background.navy950,
  "--hero-bg-edge": HERO3D_CONFIG.background.edge,
  "--hero-bg-ring": HERO3D_CONFIG.background.ring,
  "--hero-bg-center": HERO3D_CONFIG.background.center,
  "--hero-bg-outer-ring": HERO3D_CONFIG.background.outerRing,
  "--hero-bg-vignette": HERO3D_CONFIG.background.vignetteColor,
  "--hero-bg-offcenter-pool": HERO3D_CONFIG.background.offCenterPoolColor,
  "--hero-bg-grain-opacity": String(HERO3D_CONFIG.background.grainOpacity),
  "--hero-bg-marbling-opacity": String(
    HERO3D_CONFIG.background.marblingOpacity
  ),
  "--hero-bg-grain-uri": GRAIN_SVG_DATA_URI,
  "--hero-bg-marbling-uri": MARBLING_SVG_DATA_URI,
} as CSSProperties;

function HeroPosterPicture({ className = "" }: { className?: string }) {
  const p = HERO3D_CONFIG.loading.posters;
  return (
    <picture className="pointer-events-none block h-full w-full">
      <source
        media="(orientation: portrait)"
        srcSet={p.portraitAvif}
        type="image/avif"
      />
      <source
        media="(orientation: portrait)"
        srcSet={p.portraitWebp}
        type="image/webp"
      />
      <source srcSet={p.landscapeAvif} type="image/avif" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={p.landscapeWebp}
        alt=""
        decoding="async"
        className={`pointer-events-none h-full w-full object-contain object-center ${className}`}
      />
    </picture>
  );
}

export function HeroSection() {
  const locale = useLocale();
  const isArabic = locale === "ar";
  const t = useTranslations("home.hero");
  const tCommon = useTranslations("common");
  const tWa = useTranslations("whatsapp");
  const config = getLocalizedSiteConfig(locale);

  const sectionRef = useRef<HTMLElement | null>(null);
  const topBlockRef = useRef<HTMLDivElement | null>(null);
  const bottomBlockRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<HeroScene | null>(null);

  const [mount3D, setMount3D] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const [instantCanvasReset, setInstantCanvasReset] = useState(false);
  const [isReturnVisitMount, setIsReturnVisitMount] = useState(() =>
    isHeroReturnVisit()
  );
  const [showPoster, setShowPoster] = useState(() => isHeroReturnVisit());
  const [textMode, setTextMode] = useState<"hidden" | "reveal" | "instant">(
    () => (isHeroReturnVisit() ? "instant" : "hidden")
  );
  const [posterMode, setPosterMode] = useState(false);

  const measureZones = useCallback((): FramingZoneRects => {
    const sectionEl = sectionRef.current;
    if (!sectionEl) {
      return {
        viewportWidth: 1440,
        viewportHeight: 900,
        topReservedBottomPx: 220,
        bottomReservedTopPx: 700,
      };
    }
    const heroRect = sectionEl.getBoundingClientRect();
    const vw = Math.max(1, Math.round(heroRect.width || window.innerWidth));
    const vh = Math.max(1, Math.round(heroRect.height || window.innerHeight));

    let topReservedBottomPx = vh * 0.24;
    if (topBlockRef.current) {
      const topRect = topBlockRef.current.getBoundingClientRect();
      if (topRect.height > 0) {
        topReservedBottomPx = Math.max(0, topRect.bottom - heroRect.top);
      }
    }

    let bottomReservedTopPx = vh * 0.78;
    if (bottomBlockRef.current) {
      const botRect = bottomBlockRef.current.getBoundingClientRect();
      if (botRect.height > 0) {
        bottomReservedTopPx = Math.min(vh, botRect.top - heroRect.top);
      }
    }

    return {
      viewportWidth: vw,
      viewportHeight: vh,
      topReservedBottomPx,
      bottomReservedTopPx,
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const isPosterCapture = params.get("poster") === "1";

    if (isPosterCapture) {
      setPosterMode(true);
    }

    const { canRun3D } = detectCanRunHero3D();
    if (!canRun3D) {
      setShowPoster(true);
      setTextMode("instant");
      setMount3D(false);
      return;
    }

    if (!isPosterCapture && isHeroReturnVisit()) {
      setShowPoster(true);
      setTextMode("instant");
    }

    const textFailSafe = !isPosterCapture
      ? window.setTimeout(() => {
          setTextMode((prev) => (prev === "hidden" ? "reveal" : prev));
        }, HERO3D_CONFIG.loading.timeoutMs + 4600)
      : null;

    let cancelled = false;
    const rafId = window.requestAnimationFrame(() => {
      if (cancelled) return;
      setMount3D(true);
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafId);
      if (textFailSafe !== null) window.clearTimeout(textFailSafe);
    };
  }, []);

  // Replay arrival & text animation when clicking Home in the navbar while already on `/`
  useEffect(() => {
    let raf1: number | null = null;
    let raf2: number | null = null;

    const unsub = onHeroHomeNavReplay(() => {
      const scene = sceneRef.current;
      if (!scene) return;
      if (!detectCanRunHero3D().canRun3D) return;

      if (raf1 !== null) window.cancelAnimationFrame(raf1);
      if (raf2 !== null) window.cancelAnimationFrame(raf2);

      // Frame 1: snap canvas opacity to 0 (0ms) and hide text while moving car to t = 0
      setInstantCanvasReset(true);
      setIsReturnVisitMount(false);
      setShowPoster(false);
      setCanvasReady(false);
      setTextMode("hidden");
      scene.applyState(0);
      scene.renderSingleFrame();

      // Frame 2: restore 1.0 s CSS fade-in and start the arrival & synchronized text reveal
      raf1 = window.requestAnimationFrame(() => {
        raf2 = window.requestAnimationFrame(() => {
          setInstantCanvasReset(false);
          setCanvasReady(true);
          scene.startArrival(0);
        });
      });
    });

    return () => {
      unsub();
      if (raf1 !== null) window.cancelAnimationFrame(raf1);
      if (raf2 !== null) window.cancelAnimationFrame(raf2);
    };
  }, []);

  const handleSceneReady = useCallback(
    (scene: HeroScene) => {
      sceneRef.current = scene;
      setCanvasReady(true);
      setShowPoster(false);
      if (posterMode && typeof window !== "undefined") {
        (
          window as unknown as { __HERO_POSTER_READY__?: boolean }
        ).__HERO_POSTER_READY__ = true;
      }
    },
    [posterMode]
  );

  const handleFallbackToPoster = useCallback((_reason: string) => {
    sceneRef.current = null;
    setCanvasReady(false);
    setShowPoster(true);
    setTextMode((prev) => (prev === "hidden" ? "reveal" : prev));
    setTimeout(() => {
      setMount3D(false);
    }, HERO3D_CONFIG.loading.posterCrossfadeMs);
  }, []);

  const handleTextRevealChange = useCallback(
    (mode: "hidden" | "reveal" | "instant") => {
      setTextMode(mode);
    },
    []
  );

  const handleDownloadPosterPng = () => {
    const canvas = sceneRef.current?.getCanvasElement();
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `hero-poster-${canvas.width}x${canvas.height}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const canvasFadeMs =
    posterMode || instantCanvasReset
      ? 0
      : isReturnVisitMount
        ? HERO3D_CONFIG.loading.posterCrossfadeMs
        : HERO3D_CONFIG.loading.canvasFadeInMs;

  return (
    <section
      ref={sectionRef}
      style={posterMode ? undefined : HERO_BG_CSS_VARS}
      data-hero-ready={canvasReady || showPoster ? "1" : "0"}
      data-hero-mode={
        canvasReady ? "3d" : showPoster ? "poster" : "initial-navy"
      }
      data-hero-text={textMode}
      className="hero-stage relative isolate w-full overflow-hidden"
    >
      {/* 1. Original Static CSS Dark-Navy Textured Background (server-rendered on first paint) */}
      {!posterMode && (
        <div className="hero-bg" aria-hidden="true">
          <div className="hero-bg-marbling" />
          <div className="hero-bg-grain" />
          <div className="hero-bg-overlays" />
        </div>
      )}

      {/* JavaScript-disabled fallback: force hero text visible immediately + show transparent poster */}
      <noscript>
        <style>{`.hero-stage[data-hero-text="hidden"] .hero-reveal-badge,.hero-stage[data-hero-text="hidden"] .hero-reveal-h1a,.hero-stage[data-hero-text="hidden"] .hero-reveal-h1b,.hero-stage[data-hero-text="hidden"] .hero-reveal-sub,.hero-stage[data-hero-text="hidden"] .hero-reveal-ctas,.hero-stage[data-hero-text="hidden"] .hero-reveal-meta{opacity:1!important;transform:none!important;pointer-events:auto!important;}`}</style>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[1] overflow-hidden"
        >
          <HeroPosterPicture />
        </div>
      </noscript>

      {/* Art-directed transparent poster (shown on fallback or in-app return visit until canvas ready) */}
      {!posterMode && (
        <div
          aria-hidden="true"
          data-hero-poster=""
          style={{
            transitionDuration: `${HERO3D_CONFIG.loading.posterCrossfadeMs}ms`,
          }}
          className={`pointer-events-none absolute inset-0 z-[1] overflow-hidden transition-opacity ease-out ${
            showPoster ? "opacity-100" : "opacity-0"
          }`}
        >
          <HeroPosterPicture />
        </div>
      )}

      {/* Full-bleed transparent 3D canvas (fades in over 1.0 s during arrival; never mirrored in RTL) */}
      <div
        dir="ltr"
        aria-hidden="true"
        data-hero3d-stage=""
        style={{
          transitionDuration: `${canvasFadeMs}ms`,
        }}
        className={`pointer-events-none absolute inset-0 z-[2] overflow-hidden transition-opacity ease-out ${
          canvasReady ? "opacity-100" : "opacity-0"
        }`}
      >
        {mount3D && (
          <Hero3DCanvas
            posterMode={posterMode}
            locale={locale}
            measureZones={measureZones}
            onSceneReady={handleSceneReady}
            onFallbackToPoster={handleFallbackToPoster}
            onTextRevealChange={handleTextRevealChange}
          />
        )}
      </div>

      {/* Dev-only Download PNG button when ?poster=1 */}
      {posterMode &&
        process.env.NODE_ENV === "development" &&
        canvasReady && (
          <button
            type="button"
            onClick={handleDownloadPosterPng}
            className="fixed bottom-4 left-4 z-50 rounded-lg border border-white/25 bg-navy-900/95 px-4 py-2 text-xs font-semibold text-ivory shadow-lg"
          >
            Download PNG
          </button>
        )}

      {/* ROW 1 (auto): Top Reserved Zone — Eyebrow Badge + Real Semantic H1 */}
      <div
        ref={topBlockRef}
        data-hero-h1=""
        className={`hero-stage-top flex w-full max-w-4xl flex-col items-center text-center ${
          posterMode ? "invisible" : ""
        }`}
      >
        <div className="hero-reveal-badge hero-eyebrow inline-flex items-center gap-2 rounded-full border border-white/15 bg-navy-900/60 px-3.5 py-1">
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-red"
          />
          <span
            className={
              isArabic
                ? "text-xs font-medium text-silver"
                : "text-[11px] sm:text-xs font-medium uppercase tracking-[0.2em] text-silver"
            }
          >
            {t("badge")}
          </span>
        </div>

        <h1 className="mt-2 sm:mt-2.5 flex flex-col items-center font-serif text-ivory">
          <span
            className={
              isArabic
                ? "hero-reveal-h1a hero-h1a font-sans font-medium text-silver"
                : "hero-reveal-h1a hero-h1a font-sans font-medium uppercase tracking-[0.35em] text-silver"
            }
          >
            {t("h1a")}
          </span>{" "}
          <span className="hero-reveal-h1b hero-h1b hero-text-shadow mt-0.5 sm:mt-1 font-serif font-semibold leading-[1.06] tracking-tight text-ivory">
            {t("h1b")}
            <em
              className={
                isArabic
                  ? "not-italic font-bold text-ivory"
                  : "font-serif italic font-normal text-ivory/95"
              }
            >
              {t("h1bAccent")}
            </em>
          </span>
        </h1>
      </div>

      {/* ROW 2 (minmax(0, 1fr)): Car framing window */}
      <div aria-hidden="true" className="hero-car-row" />

      {/* ROW 3 (auto): Bottom Reserved Zone — Subtitle + Two CTAs + Brand Line + Static Scroll Cue */}
      <div
        ref={bottomBlockRef}
        data-hero-bottom-zone=""
        className={`hero-stage-bottom flex w-full max-w-2xl flex-col items-center px-3 py-1 text-center ${
          posterMode ? "invisible" : ""
        }`}
      >
        <p className="hero-reveal-sub hero-subtitle-shadow max-w-xl text-xs sm:text-sm md:text-base text-silver">
          {t("subtitle")}
        </p>

        <div className="hero-reveal-ctas hero-stage-cta-row hero-cta-row mt-2.5 sm:mt-3.5 flex w-full max-w-md sm:max-w-none flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 sm:gap-3">
          <Link
            href="/vehicules"
            className="inline-flex min-h-[44px] sm:min-h-[48px] items-center justify-center gap-2 rounded-xl border border-brand-red bg-navy-950/90 px-5 sm:px-7 py-2.5 sm:py-3 text-sm font-semibold text-ivory shadow-lg shadow-black/35 transition-colors hover:bg-brand-red hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ivory focus-visible:ring-offset-2 focus-visible:ring-offset-navy-950"
          >
            <span>{t("ctaVehicles")}</span>
            <span aria-hidden="true" className="rtl:rotate-180">
              &rarr;
            </span>
          </Link>

          <a
            href={getWhatsAppUrl(tWa("genericMessage"))}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] sm:min-h-[48px] items-center justify-center gap-2.5 rounded-xl border border-whatsapp-green bg-navy-950/85 px-5 sm:px-7 py-2.5 sm:py-3 text-sm font-semibold text-whatsapp-green transition-colors hover:bg-whatsapp-green hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-whatsapp-green focus-visible:ring-offset-2 focus-visible:ring-offset-navy-950"
          >
            <WhatsAppIcon className="h-5 w-5 shrink-0 fill-current" />
            <span>{tCommon("whatsapp")}</span>
          </a>
        </div>

        <div className="hero-reveal-meta flex flex-col items-center">
          {/* Brand line: hidden below 760px viewport height and below lg width */}
          <p
            dir="ltr"
            className="hero-brand-line hidden lg:block mt-3 whitespace-nowrap text-[11px] font-medium uppercase tracking-[0.26em] text-silver/65"
          >
            {config.brands.join("  ·  ")}
          </p>

          {/* Static scroll cue: hidden below 650px viewport height */}
          <div
            aria-hidden="true"
            className="hero-stage-scroll mt-2.5 hidden sm:flex flex-col items-center gap-1 opacity-70"
          >
            <span
              className={
                isArabic
                  ? "text-[11px] font-medium text-silver/80"
                  : "text-[10px] font-medium uppercase tracking-[0.24em] text-silver/80"
              }
            >
              {t("scroll")}
            </span>
            <span className="h-3 w-[1px] bg-gradient-to-b from-brand-red to-transparent" />
          </div>
        </div>
      </div>
    </section>
  );
}
