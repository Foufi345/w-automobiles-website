"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Car } from "@/lib/car-types";
import { CarCard } from "@/components/CarCard";
import { useGsap } from "@/hooks/useGsap";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { gsap, ScrollTrigger, SplitText } from "@/lib/gsap";
import { scheduleScrollRefresh, completeIfPastStart } from "@/lib/refreshScroll";

interface FeaturedCarsHorizontalProps {
  cars: Car[];
}

export function FeaturedCarsHorizontal({ cars }: FeaturedCarsHorizontalProps) {
  const locale = useLocale();
  const t = useTranslations("home.featured");
  const sectionRef = useRef<HTMLElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);

  const isReducedMotion = useReducedMotion();
  const [activeSlide, setActiveSlide] = useState(0);

  const handleMobileTrackScroll = () => {
    const track = trackRef.current;
    if (!track || window.innerWidth >= 1024) return;
    const firstCard = track.querySelector<HTMLElement>(".featured-card-wrapper");
    if (!firstCard) return;
    const step = firstCard.offsetWidth + 24;
    if (step <= 0) return;
    // Use Math.abs(scrollLeft) so RTL negative scrollLeft maps cleanly to 0..N-1
    const idx = Math.max(
      0,
      Math.min(cars.length - 1, Math.round(Math.abs(track.scrollLeft) / step))
    );
    setActiveSlide(idx);
  };

  const scrollToSlide = (idx: number) => {
    const track = trackRef.current;
    if (!track) return;
    const cards = track.querySelectorAll<HTMLElement>(".featured-card-wrapper");
    cards[idx]?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  };

  // Refresh ScrollTrigger once all track images decode so scrollWidth is exact
  useEffect(() => {
    const track = trackRef.current;
    if (!track || typeof window === "undefined") return;

    const imgs = Array.from(track.querySelectorAll("img"));
    if (imgs.length === 0) return;

    const decodePromises = imgs.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      if (typeof img.decode === "function") {
        return img.decode().catch(() => { });
      }
      return new Promise<void>((resolve) => {
        img.addEventListener("load", () => resolve(), { once: true });
        img.addEventListener("error", () => resolve(), { once: true });
      });
    });

    Promise.all(decodePromises).then(() => {
      scheduleScrollRefresh(150);
    });
  }, [cars]);

  useGsap(
    () => {
      const section = sectionRef.current;
      const track = trackRef.current;
      if (!section) return;

      // 1. Heading reveal (with onRefresh fail-safe if scrolled past)
      let split: SplitText | null = null;
      if (headingRef.current) {
        if (!isReducedMotion) {
          split = SplitText.create(headingRef.current, {
            type: "lines",
            mask: "lines",
            autoSplit: true,
            linesClass: "py-1",
          });

          const headingTl = gsap.timeline({ paused: true });
          headingTl.fromTo(
            split.lines,
            { yPercent: 110, opacity: 0 },
            {
              yPercent: 0,
              opacity: 1,
              duration: 0.9,
              stagger: 0.08,
              ease: "power3.out",
            }
          );

          ScrollTrigger.create({
            trigger: headingRef.current,
            start: "top 85%",
            once: true,
            onEnter: () => headingTl.play(),
            onRefresh: (st) => completeIfPastStart(headingTl, st),
          });
        } else {
          gsap.set(headingRef.current, { opacity: 1, y: 0, clearProps: "all" });
        }
      }

      // 2. Desktop (>= 1024px) pinned horizontal scroll via gsap.matchMedia()
      if (isReducedMotion || !track) {
        return () => {
          split?.revert();
        };
      }

      const mm = gsap.matchMedia();

      mm.add("(min-width: 1024px)", () => {
        const isRtl = locale === "ar" || document.documentElement.dir === "rtl";
        const dirFactor = isRtl ? 1 : -1;
        const getScrollDistance = () =>
          Math.max(0, track.scrollWidth - window.innerWidth + 96);

        const resetTrackOnRefresh = () => {
          gsap.set(track, { x: 0 });
        };
        ScrollTrigger.addEventListener("refreshInit", resetTrackOnRefresh);

        const horizontalTween = gsap.to(track, {
          x: () => dirFactor * getScrollDistance(),
          ease: "none",
        });

        ScrollTrigger.create({
          trigger: section,
          start: "top top",
          end: () => `+=${getScrollDistance()}`,
          pin: true,
          pinSpacing: true,
          scrub: 0.8,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          animation: horizontalTween,
        });

        if (progressBarRef.current) {
          gsap.fromTo(
            progressBarRef.current,
            { scaleX: 0 },
            {
              scaleX: 1,
              ease: "none",
              scrollTrigger: {
                trigger: section,
                start: "top top",
                end: () => `+=${getScrollDistance()}`,
                scrub: 0.8,
                invalidateOnRefresh: true,
              },
            }
          );
        }

        return () => {
          ScrollTrigger.removeEventListener("refreshInit", resetTrackOnRefresh);
          gsap.set(track, { clearProps: "transform" });
        };
      });

      scheduleScrollRefresh(150);

      return () => {
        mm.revert();
        split?.revert();
      };
    },
    { scope: sectionRef, dependencies: [locale, isReducedMotion, cars.length], revertOnUpdate: true }
  );

  return (
    <section
      ref={sectionRef}
      aria-labelledby="featured-vehicles-heading"
      className="relative isolate border-b border-navy-700/60 bg-navy-950 py-14 lg:py-0 lg:h-svh-safe lg:flex lg:flex-col lg:justify-center overflow-hidden"
    >
      <div className="container-site mb-6 lg:mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-navy-700/70 pb-5 shrink-0">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-silver">
            {t("eyebrow")}
          </p>
          <h2
            ref={headingRef}
            id="featured-vehicles-heading"
            aria-label={t("title")}
            className="mt-1.5 font-serif text-3xl sm:text-4xl lg:text-5xl font-semibold text-ivory"
          >
            {t("title")}
          </h2>
        </div>

        <Link
          href="/vehicules"
          className="inline-flex min-h-[44px] items-center gap-2 self-start sm:self-auto text-sm font-medium text-silver transition-colors hover:text-ivory"
        >
          <span>{t("viewAll")}</span>
          <span aria-hidden="true" className="rtl:rotate-180">
            &rarr;
          </span>
        </Link>
      </div>

      {/* Horizontal Track: pinned on desktop (>=1024px), native horizontal snap carousel with peek on mobile/tablet */}
      <div className="w-full overflow-hidden">
        <div
          ref={trackRef}
          onScroll={handleMobileTrackScroll}
          className="flex flex-nowrap items-stretch gap-4 sm:gap-6 px-4 sm:px-8 lg:px-12 overflow-x-auto lg:overflow-visible pb-4 lg:pb-1 snap-x snap-mandatory lg:snap-none"
        >
          {cars.map((car) => (
            <div
              key={car.id}
              className="featured-card-wrapper flex w-[84vw] max-w-[360px] lg:w-[clamp(320px,30vw,420px)] lg:max-w-none shrink-0 snap-start"
            >
              <div className="w-full">
                <CarCard car={car} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile carousel pagination dots */}
      {cars.length > 1 && (
        <div
          className="mt-4 flex items-center justify-center gap-2 lg:hidden"
          role="tablist"
          aria-label={t("paginationLabel")}
        >
          {cars.map((car, idx) => (
            <button
              key={car.id}
              type="button"
              role="tab"
              aria-selected={activeSlide === idx}
              aria-label={t("showVehicle", { brand: car.brand, model: car.model })}
              onClick={() => scrollToSlide(idx)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full"
            >
              <span
                className={`block h-2 rounded-full transition-all ${activeSlide === idx
                  ? "w-6 bg-brand-red"
                  : "w-2 bg-navy-700"
                  }`}
              />
            </button>
          ))}
        </div>
      )}

      {/* Progress bar (desktop only) */}
      <div className="container-site mt-6 hidden lg:block shrink-0">
        <div className="h-[2px] w-full bg-navy-700/60 overflow-hidden rounded-full">
          <div
            ref={progressBarRef}
            aria-hidden="true"
            className="h-full bg-brand-red w-full origin-left rtl:origin-right scale-x-0"
          />
        </div>
      </div>
    </section>
  );
}
