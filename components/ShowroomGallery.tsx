"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { gsap, Flip } from "@/lib/gsap";
import { useReducedMotion } from "@/hooks/useReducedMotion";

export interface ShowroomPhoto {
  src: string;
  title: string;
  caption: string;
}

interface ShowroomGalleryProps {
  photos: readonly ShowroomPhoto[];
}

export function ShowroomGallery({ photos }: ShowroomGalleryProps) {
  const t = useTranslations("showroom");
  const tCommon = useTranslations("common");
  const [activeIndex, setActiveIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const reducedMotion = useReducedMotion();

  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lightboxImageRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const touchStartX = useRef<number | null>(null);
  const total = photos.length;

  const animateSlide = useCallback(
    (direction: 1 | -1 = 1) => {
      if (!lightboxImageRef.current || reducedMotion) return;
      const isRtl =
        typeof document !== "undefined" &&
        document.documentElement.dir === "rtl";
      gsap.fromTo(
        lightboxImageRef.current,
        { opacity: 0, scale: 0.97, x: direction * (isRtl ? -25 : 25) },
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
      animateSlide(-1);
      return nextIdx;
    });
  }, [total, animateSlide]);

  const goNext = useCallback(() => {
    setActiveIndex((prev) => {
      const nextIdx = (prev + 1) % total;
      animateSlide(1);
      return nextIdx;
    });
  }, [total, animateSlide]);

  const openAt = (index: number) => {
    setActiveIndex(index);
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;

    const clickedCard = cardRefs.current[index];

    if (reducedMotion || !clickedCard) {
      dialog.showModal();
      setIsOpen(true);
      return;
    }

    // GSAP Flip animation: capture thumbnail state
    const state = Flip.getState(clickedCard);
    dialog.showModal();
    setIsOpen(true);

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
    const dialog = dialogRef.current;
    if (!dialog?.open) return;

    const targetCard = cardRefs.current[activeIndex];

    if (reducedMotion || !lightboxImageRef.current || !targetCard) {
      dialog.close();
      setIsOpen(false);
      return;
    }

    const state = Flip.getState(lightboxImageRef.current);
    dialog.close();
    setIsOpen(false);

    Flip.from(state, {
      targets: targetCard,
      duration: 0.45,
      ease: "power3.inOut",
    });
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
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
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, goPrev, goNext]);

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

  const currentPhoto = photos[activeIndex] ?? photos[0];

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:gap-5">
        {photos.map((photo, idx) => (
          <button
            key={photo.src}
            ref={(el) => {
              cardRefs.current[idx] = el;
            }}
            type="button"
            onClick={() => openAt(idx)}
            aria-label={t("galleryZoomAria", { title: photo.title })}
            className="group relative aspect-[3/2] w-full overflow-hidden rounded-xl border border-navy-700 bg-navy-900 text-start transition-all duration-200 hover:border-silver/50"
          >
            <Image
              src={photo.src}
              alt={`${photo.title} — ${photo.caption}`}
              fill
              sizes="(max-width: 639px) 100vw, 576px"
              className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy-950/90 via-navy-950/50 to-transparent p-4 sm:p-5 flex items-end justify-between gap-3">
              <div>
                <p className="font-serif text-lg sm:text-xl font-semibold text-ivory">
                  {photo.title}
                </p>
                <p className="text-xs text-silver">{photo.caption}</p>
              </div>
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-navy-700 bg-navy-950/80 text-ivory transition-colors group-hover:border-brand-red">
                <svg
                  aria-hidden="true"
                  className="h-4 w-4"
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
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Lightbox modal dialog with GSAP Flip morph */}
      <dialog
        ref={dialogRef}
        aria-label={t("galleryDialogLabel")}
        onClose={() => setIsOpen(false)}
        onClick={(e) => {
          if (
            containerRef.current &&
            !containerRef.current.contains(e.target as Node)
          ) {
            closeLightbox();
          }
        }}
        className="m-0 h-full max-h-none w-full max-w-none bg-navy-950/95 p-4 sm:p-8 text-ivory backdrop:bg-navy-950/90"
      >
        <div
          ref={containerRef}
          className="mx-auto flex h-full max-w-5xl flex-col justify-between gap-4"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-serif text-lg sm:text-xl font-semibold text-ivory">
                {currentPhoto?.title}
              </p>
              <p className="text-xs text-silver">
                {tCommon("photoOf", { current: activeIndex + 1, total })} &middot;{" "}
                {currentPhoto?.caption}
              </p>
            </div>

            <button
              type="button"
              onClick={closeLightbox}
              aria-label={t("galleryClose")}
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

          <div
            ref={lightboxImageRef}
            className="relative my-auto aspect-[3/2] w-full max-h-[75svh] overflow-hidden rounded-xl border border-navy-700 bg-navy-900"
          >
            {currentPhoto && (
              <Image
                src={currentPhoto.src}
                alt={`${currentPhoto.title} — ${currentPhoto.caption}`}
                fill
                sizes="100vw"
                className="object-contain"
              />
            )}

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
          </div>

          <div className="flex items-center justify-center gap-2.5 overflow-x-auto py-1">
            {photos.map((photo, idx) => (
              <button
                key={photo.src}
                type="button"
                onClick={() => {
                  animateSlide(idx > activeIndex ? 1 : -1);
                  setActiveIndex(idx);
                }}
                aria-label={t("galleryShowAria", { title: photo.title })}
                className={`relative aspect-[3/2] w-20 shrink-0 overflow-hidden rounded-lg border ${
                  idx === activeIndex
                    ? "border-brand-red ring-2 ring-brand-red/40"
                    : "border-navy-700 opacity-60 hover:opacity-100"
                }`}
              >
                <Image
                  src={photo.src}
                  alt={photo.title}
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      </dialog>
    </>
  );
}
