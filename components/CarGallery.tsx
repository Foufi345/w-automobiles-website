"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { DistortImage } from "@/components/webgl/DistortImage";
import { gsap, Flip } from "@/lib/gsap";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface CarGalleryProps {
  images: string[];
  altBase: string;
  onLightboxChange?: (open: boolean) => void;
}

export function CarGallery({
  images,
  altBase,
  onLightboxChange,
}: CarGalleryProps) {
  const tCar = useTranslations("car");
  const tCommon = useTranslations("common");
  const safeImages = images.length > 0 ? images : ["/images/showroom-hero.jpg"];
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const reducedMotion = useReducedMotion();

  const mainImageContainerRef = useRef<HTMLDivElement | null>(null);
  const lightboxRef = useRef<HTMLDialogElement | null>(null);
  const lightboxContentRef = useRef<HTMLDivElement | null>(null);
  const lightboxImageRef = useRef<HTMLDivElement | null>(null);
  const touchStartX = useRef<number | null>(null);

  const total = safeImages.length;

  const animateSlideChange = useCallback(
    (direction: 1 | -1 = 1) => {
      if (!lightboxImageRef.current || reducedMotion) return;
      const isRtl =
        typeof document !== "undefined" &&
        document.documentElement.dir === "rtl";
      gsap.fromTo(
        lightboxImageRef.current,
        {
          opacity: 0,
          scale: 0.97,
          x: direction * (isRtl ? -30 : 30),
        },
        {
          opacity: 1,
          scale: 1,
          x: 0,
          duration: 0.45,
          ease: "power3.out",
          overwrite: "auto",
        }
      );
    },
    [reducedMotion]
  );

  const goPrev = useCallback(() => {
    setActiveIndex((prev) => {
      const nextIdx = (prev - 1 + total) % total;
      animateSlideChange(-1);
      return nextIdx;
    });
  }, [total, animateSlideChange]);

  const goNext = useCallback(() => {
    setActiveIndex((prev) => {
      const nextIdx = (prev + 1) % total;
      animateSlideChange(1);
      return nextIdx;
    });
  }, [total, animateSlideChange]);

  useEffect(() => {
    onLightboxChange?.(isLightboxOpen);
  }, [isLightboxOpen, onLightboxChange]);

  const openLightbox = () => {
    const dialog = lightboxRef.current;
    if (!dialog || dialog.open) return;

    if (reducedMotion || !mainImageContainerRef.current) {
      dialog.showModal();
      setIsLightboxOpen(true);
      return;
    }

    // GSAP Flip animation: capture thumbnail / main frame state
    const state = Flip.getState(mainImageContainerRef.current);
    dialog.showModal();
    setIsLightboxOpen(true);

    requestAnimationFrame(() => {
      if (lightboxImageRef.current) {
        Flip.from(state, {
          targets: lightboxImageRef.current,
          duration: 0.55,
          ease: "power3.out",
          fade: true,
        });
      }
    });
  };

  const closeLightbox = () => {
    const dialog = lightboxRef.current;
    if (!dialog?.open) return;

    if (
      reducedMotion ||
      !lightboxImageRef.current ||
      !mainImageContainerRef.current
    ) {
      dialog.close();
      setIsLightboxOpen(false);
      return;
    }

    const state = Flip.getState(lightboxImageRef.current);
    dialog.close();
    setIsLightboxOpen(false);

    if (mainImageContainerRef.current) {
      Flip.from(state, {
        targets: mainImageContainerRef.current,
        duration: 0.45,
        ease: "power3.inOut",
      });
    }
  };

  // Keyboard navigation when lightbox is open
  useEffect(() => {
    if (!isLightboxOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isRtl = document.documentElement.dir === "rtl";
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (isRtl) goNext();
        else goPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (isRtl) goPrev();
        else goNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLightboxOpen, goPrev, goNext]);

  // Touch swipe handlers with inertia
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
    const diff = touchStartX.current - endX;
    const isRtl =
      typeof document !== "undefined" &&
      document.documentElement.dir === "rtl";
    if (Math.abs(diff) > 42 && total > 1) {
      if (isRtl) {
        if (diff > 0) goPrev();
        else goNext();
      } else {
        if (diff > 0) goNext();
        else goPrev();
      }
    }
    touchStartX.current = null;
  };

  return (
    <div className="space-y-3.5">
      {/* Main Image Frame with WebGL Distort & Parallax */}
      <div
        ref={mainImageContainerRef}
        style={{ position: "relative", width: "100%", aspectRatio: "3 / 2", overflow: "hidden" }}
        className="group relative aspect-[3/2] w-full overflow-hidden rounded-xl border border-navy-700 bg-navy-900 touch-pan-y"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <button
          type="button"
          onClick={openLightbox}
          aria-label={tCar("galleryZoomAria", {
            current: activeIndex + 1,
            total,
            title: altBase,
          })}
          className="relative block h-full w-full cursor-zoom-in text-start focus:outline-none"
        >
          <DistortImage
            src={safeImages[activeIndex]}
            alt={`${altBase} — ${tCommon("photoOf", { current: activeIndex + 1, total })}`}
            priority={true}
            enableParallax={true}
            sizes="(max-width: 1023px) 100vw, 720px"
          />
        </button>

        {/* Zoom hint pill */}
        <div className="pointer-events-none absolute bottom-3 end-3 inline-flex items-center gap-1.5 rounded-full border border-navy-700/80 bg-navy-950/85 px-3 py-1.5 text-xs text-silver backdrop-blur-sm">
          <svg
            aria-hidden="true"
            className="h-3.5 w-3.5 text-ivory"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.75}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607ZM10.5 7.5v6m3-3h-6"
            />
          </svg>
          <span>
            {activeIndex + 1} / {total} &middot; {tCommon("zoom")}
          </span>
        </div>

        {/* Previous / Next controls when multiple images exist */}
        {total > 1 && (
          <>
            <button
              type="button"
              onClick={goPrev}
              aria-label={tCommon("previousPhoto")}
              className="absolute start-3 top-1/2 -translate-y-1/2 inline-flex h-11 w-11 items-center justify-center rounded-full border border-navy-700/90 bg-navy-950/80 text-ivory backdrop-blur-sm transition-all hover:border-silver/60 hover:bg-navy-950 opacity-80 hover:opacity-100"
            >
              <svg
                aria-hidden="true"
                className="h-5 w-5 rtl:rotate-180"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 19.5 8.25 12l7.5-7.5"
                />
              </svg>
            </button>

            <button
              type="button"
              onClick={goNext}
              aria-label={tCommon("nextPhoto")}
              className="absolute end-3 top-1/2 -translate-y-1/2 inline-flex h-11 w-11 items-center justify-center rounded-full border border-navy-700/90 bg-navy-950/80 text-ivory backdrop-blur-sm transition-all hover:border-silver/60 hover:bg-navy-950 opacity-80 hover:opacity-100"
            >
              <svg
                aria-hidden="true"
                className="h-5 w-5 rtl:rotate-180"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m8.25 4.5 7.5 7.5-7.5 7.5"
                />
              </svg>
            </button>
          </>
        )}
      </div>

      {/* Thumbnails Strip (hidden on phones, visible from sm+) */}
      {total > 1 && (
        <div
          role="region"
          aria-label={tCar("galleryThumbnailsLabel")}
          className="hidden sm:flex items-center gap-3 overflow-x-auto pb-1"
        >
          {safeImages.map((imgSrc, idx) => {
            const isSelected = idx === activeIndex;
            return (
              <button
                key={imgSrc}
                type="button"
                onClick={() => {
                  animateSlideChange(idx > activeIndex ? 1 : -1);
                  setActiveIndex(idx);
                }}
                aria-label={tCommon("showPhoto", { number: idx + 1 })}
                aria-current={isSelected ? "true" : undefined}
                className={`relative aspect-[3/2] w-24 sm:w-28 shrink-0 overflow-hidden rounded-xl border transition-all ${
                  isSelected
                    ? "border-brand-red ring-2 ring-brand-red/40 opacity-100"
                    : "border-navy-700 opacity-65 hover:opacity-100 hover:border-silver/40"
                }`}
              >
                <Image
                  src={imgSrc}
                  alt={`${altBase} — ${tCommon("thumbnail", { number: idx + 1 })}`}
                  fill
                  sizes="112px"
                  className="object-cover"
                />
              </button>
            );
          })}
        </div>
      )}

      {/* Full-Screen Lightbox (<dialog>) with GSAP Flip morph */}
      <dialog
        ref={lightboxRef}
        aria-label={tCar("galleryFullscreenLabel", { title: altBase })}
        onClose={() => setIsLightboxOpen(false)}
        onClick={(e) => {
          if (
            lightboxContentRef.current &&
            !lightboxContentRef.current.contains(e.target as Node)
          ) {
            closeLightbox();
          }
        }}
        className="m-0 h-full max-h-none w-full max-w-none bg-navy-950/95 p-4 sm:p-8 text-ivory backdrop:bg-navy-950/90"
      >
        <div
          ref={lightboxContentRef}
          className="mx-auto flex h-full max-w-5xl flex-col justify-between gap-4"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Top bar */}
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-medium text-silver">
              {altBase} &mdash; {tCommon("photoOf", { current: activeIndex + 1, total })}
            </p>
            <button
              type="button"
              onClick={closeLightbox}
              aria-label={tCar("galleryCloseFullscreen")}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-navy-700 bg-navy-900 text-ivory transition-colors hover:border-silver/50"
            >
              <svg
                aria-hidden="true"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.75}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18 18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Center Zoomed Image */}
          <div
            ref={lightboxImageRef}
            className="relative my-auto aspect-[3/2] w-full max-h-[75svh] overflow-hidden rounded-xl border border-navy-700 bg-navy-900"
          >
            <Image
              src={safeImages[activeIndex]}
              alt={`${altBase} — ${tCommon("enlargedView", { number: activeIndex + 1 })}`}
              fill
              sizes="100vw"
              className="object-contain"
            />

            {total > 1 && (
              <>
                <button
                  type="button"
                  onClick={goPrev}
                  aria-label={tCommon("previousPhoto")}
                  className="absolute start-3 top-1/2 -translate-y-1/2 inline-flex h-11 w-11 items-center justify-center rounded-full border border-navy-700 bg-navy-950/85 text-ivory transition-colors hover:border-silver/60"
                >
                  <svg
                    aria-hidden="true"
                    className="h-5 w-5 rtl:rotate-180"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.75 19.5 8.25 12l7.5-7.5"
                    />
                  </svg>
                </button>

                <button
                  type="button"
                  onClick={goNext}
                  aria-label={tCommon("nextPhoto")}
                  className="absolute end-3 top-1/2 -translate-y-1/2 inline-flex h-11 w-11 items-center justify-center rounded-full border border-navy-700 bg-navy-950/85 text-ivory transition-colors hover:border-silver/60"
                >
                  <svg
                    aria-hidden="true"
                    className="h-5 w-5 rtl:rotate-180"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m8.25 4.5 7.5 7.5-7.5 7.5"
                    />
                  </svg>
                </button>
              </>
            )}
          </div>

          {/* Bottom thumbnails in lightbox */}
          {total > 1 && (
            <div className="flex items-center justify-center gap-2.5 overflow-x-auto py-1">
              {safeImages.map((imgSrc, idx) => (
                <button
                  key={imgSrc}
                  type="button"
                  onClick={() => {
                    animateSlideChange(idx > activeIndex ? 1 : -1);
                    setActiveIndex(idx);
                  }}
                  aria-label={tCommon("photoNumber", { number: idx + 1 })}
                  className={`relative aspect-[3/2] w-20 shrink-0 overflow-hidden rounded-lg border ${
                    idx === activeIndex
                      ? "border-brand-red ring-2 ring-brand-red/40"
                      : "border-navy-700 opacity-60 hover:opacity-100"
                  }`}
                >
                  <Image
                    src={imgSrc}
                    alt={`${altBase} — ${tCommon("thumbnail", { number: idx + 1 })}`}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </dialog>
    </div>
  );
}
