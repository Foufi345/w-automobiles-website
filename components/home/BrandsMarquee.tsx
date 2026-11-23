"use client";

import { useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { siteConfig } from "@/lib/config";
import { useGsap } from "@/hooks/useGsap";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { gsap, ScrollTrigger, SplitText } from "@/lib/gsap";
import { completeIfPastStart } from "@/lib/refreshScroll";

export function BrandsMarquee() {
  const locale = useLocale();
  const t = useTranslations("home.brands");
  const sectionRef = useRef<HTMLElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);

  const isReducedMotion = useReducedMotion();
  const brandsList = [
    ...siteConfig.brands,
    ...siteConfig.brands,
    ...siteConfig.brands,
  ];

  useGsap(
    () => {
      const section = sectionRef.current;
      const track = trackRef.current;
      if (!section) return;

      // 1. Section title reveal with onRefresh fail-safe
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

      // 2. Infinite marquee reacting to scroll velocity (will-change only while moving)
      if (!track) {
        return () => split?.revert();
      }

      if (isReducedMotion) {
        gsap.set(track, { x: 0, clearProps: "willChange" });
        return () => split?.revert();
      }

      const isRtl = locale === "ar" || document.documentElement.dir === "rtl";
      const rtlSign = isRtl ? 1 : -1;
      let xPos = 0;
      const baseSpeed = 0.9;
      let scrollVelocity = 0;
      let isInView = false;

      const velocityTrigger = ScrollTrigger.create({
        onUpdate: (self) => {
          if (isInView) {
            scrollVelocity = self.getVelocity() * 0.005 * (isRtl ? -1 : 1);
          }
        },
      });

      const tickerCallback = () => {
        if (!isInView) return;

        scrollVelocity *= 0.93;
        const direction =
          scrollVelocity > 0.5
            ? rtlSign
            : scrollVelocity < -0.5
              ? -rtlSign
              : rtlSign;
        const speed = baseSpeed + Math.min(Math.abs(scrollVelocity), 8.0);

        xPos += direction * speed;

        const thirdWidth = track.scrollWidth / 3;
        if (thirdWidth > 0) {
          if (xPos <= -thirdWidth) {
            xPos += thirdWidth;
          } else if (xPos >= thirdWidth) {
            xPos -= thirdWidth;
          } else if (!isRtl && xPos >= 0) {
            xPos -= thirdWidth;
          } else if (isRtl && xPos <= 0) {
            xPos += thirdWidth;
          }
        }

        gsap.set(track, { x: xPos });
      };

      const observer = new IntersectionObserver(
        (entries) => {
          const visible = entries[0]?.isIntersecting ?? false;
          if (visible !== isInView) {
            isInView = visible;
            track.style.willChange = isInView ? "transform" : "auto";
          }
        },
        { threshold: 0.01 }
      );
      observer.observe(section);

      gsap.ticker.add(tickerCallback);

      return () => {
        observer.disconnect();
        track.style.willChange = "auto";
        gsap.ticker.remove(tickerCallback);
        velocityTrigger.kill();
        split?.revert();
      };
    },
    { scope: sectionRef, dependencies: [locale, isReducedMotion], revertOnUpdate: true }
  );

  return (
    <section
      ref={sectionRef}
      aria-labelledby="brands-heading"
      className="relative isolate overflow-hidden border-b border-navy-700/70 bg-navy-900 py-12 sm:py-16"
    >
      <div className="container-site mb-6 text-center">
        <h2
          ref={headingRef}
          id="brands-heading"
          aria-label={t("title")}
          className="text-xs sm:text-sm font-semibold uppercase tracking-widest text-silver"
        >
          {t("title")}
        </h2>
      </div>

      {/* Fixed-height (160px) Marquee Container */}
      <div className="relative flex h-[160px] w-full items-center overflow-hidden select-none">
        {/* Soft edge masks matching solid bg-navy-900 */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 sm:w-32 bg-gradient-to-r from-navy-900 via-navy-900/80 to-transparent"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 sm:w-32 bg-gradient-to-l from-navy-900 via-navy-900/80 to-transparent"
        />

        <div
          ref={trackRef}
          className="flex items-center gap-12 sm:gap-16 whitespace-nowrap"
        >
          {brandsList.map((brand, index) => (
            <Link
              key={`${brand}-${index}`}
              href={`/vehicules?brand=${encodeURIComponent(brand)}`}
              dir="ltr"
              className="group font-serif uppercase tracking-widest text-transparent transition-colors duration-300 hover:text-ivory inline-block py-2"
              style={{
                WebkitTextStroke: "1.5px #A9B4BF",
                fontSize: "clamp(2.5rem, 6vw, 4.75rem)",
                lineHeight: "1",
              }}
            >
              <span>{brand}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
