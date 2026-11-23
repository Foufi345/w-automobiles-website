"use client";

import { useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { getLocalizedSiteConfig } from "@/lib/config";
import { useGsap } from "@/hooks/useGsap";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { gsap, ScrollTrigger, SplitText } from "@/lib/gsap";
import { completeIfPastStart } from "@/lib/refreshScroll";

export function VisitUsSection() {
  const locale = useLocale();
  const t = useTranslations("home.visitUs");
  const tCommon = useTranslations("common");
  const config = getLocalizedSiteConfig(locale);
  const sectionRef = useRef<HTMLElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const subtextRef = useRef<HTMLParagraphElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  const isReducedMotion = useReducedMotion();

  useGsap(
    () => {
      const section = sectionRef.current;
      if (!section) return;

      let split: SplitText | null = null;

      if (!isReducedMotion) {
        const tl = gsap.timeline({
          paused: true,
          defaults: { ease: "power3.out" },
        });

        if (cardRef.current) {
          tl.fromTo(
            cardRef.current,
            { y: 36, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.85, clearProps: "transform" }
          );
        }

        if (headingRef.current) {
          split = SplitText.create(headingRef.current, {
            type: "lines",
            mask: "lines",
            autoSplit: true,
            linesClass: "py-1",
          });

          tl.fromTo(
            split.lines,
            { yPercent: 110, opacity: 0 },
            { yPercent: 0, opacity: 1, duration: 0.9, stagger: 0.08 },
            "-=0.6"
          );
        }

        if (subtextRef.current) {
          tl.fromTo(
            subtextRef.current,
            { y: 20, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.75 },
            "-=0.65"
          );
        }

        ScrollTrigger.create({
          trigger: section,
          start: "top 85%",
          once: true,
          onEnter: (st) => {
            if (Math.abs(st.getVelocity()) > 1200 || window.scrollY > st.end) {
              tl.progress(1);
            } else {
              tl.play();
            }
          },
          onRefresh: (st) => completeIfPastStart(tl, st),
        });
      } else {
        gsap.set([headingRef.current, subtextRef.current, cardRef.current], {
          clearProps: "all",
        });
      }

      return () => {
        split?.revert();
      };
    },
    { scope: sectionRef, dependencies: [locale, isReducedMotion], revertOnUpdate: true }
  );

  return (
    <section
      ref={sectionRef}
      aria-labelledby="visit-us-heading"
      className="relative isolate border-t border-navy-700/70 bg-navy-900 py-16 sm:py-24"
    >
      <div className="container-site">
        <div
          ref={cardRef}
          className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 rounded-2xl border border-navy-700 bg-navy-950 p-8 sm:p-12 shadow-xl"
        >
          <div className="space-y-4 max-w-xl">
            <div>
              <p
                ref={subtextRef}
                className="text-xs font-semibold uppercase tracking-widest text-silver"
              >
                {t("eyebrow")}
              </p>
              <h2
                ref={headingRef}
                id="visit-us-heading"
                aria-label={t("title")}
                className="mt-1.5 font-serif text-3xl sm:text-4xl font-semibold text-ivory"
              >
                {t("title")}
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-3 text-sm">
              <div className="flex items-start gap-3">
                <svg
                  aria-hidden="true"
                  width="20"
                  height="20"
                  className="mt-0.5 h-5 w-5 shrink-0 text-brand-red"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.75}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"
                  />
                </svg>
                <div>
                  <p className="font-medium text-ivory">{t("addressLabel")}</p>
                  <p className="mt-0.5 text-silver text-xs leading-relaxed">
                    {config.address.full}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <svg
                  aria-hidden="true"
                  width="20"
                  height="20"
                  className="mt-0.5 h-5 w-5 shrink-0 text-brand-red"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.75}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                  />
                </svg>
                <div>
                  <p className="font-medium text-ivory">{t("hoursLabel")}</p>
                  <p className="mt-0.5 text-silver text-xs">
                    {config.hours.schedule}
                  </p>
                  <p className="text-xs text-silver/80">{config.hours.closed}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 shrink-0">
            <a
              href={config.address.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-xl bg-brand-red px-7 py-3.5 text-sm font-semibold text-ivory shadow-lg shadow-brand-red/20 transition-opacity duration-200 hover:opacity-95 focus-visible:ring-2 focus-visible:ring-ivory"
            >
              <svg
                aria-hidden="true"
                width="16"
                height="16"
                className="h-4 w-4 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z"
                />
              </svg>
              <span>{t("directions")}</span>
            </a>

            <Link
              href="/showroom"
              className="inline-flex min-h-[50px] items-center justify-center rounded-xl border border-navy-700 bg-navy-900 px-7 py-3.5 text-sm font-medium text-ivory transition-colors hover:border-silver/50 hover:bg-navy-950"
            >
              {t("discoverShowroom")}
            </Link>
          </div>
        </div>

        {/* Embedded Google Map directly under "Rendez-nous visite à Cheraga" */}
        <div className="mt-8 overflow-hidden rounded-2xl border border-navy-700 bg-navy-950 shadow-xl">
          <div className="relative h-[340px] sm:h-[420px] w-full">
            <iframe
              title={tCommon("mapTitle", {
                name: config.name,
                address: config.address.full,
              })}
              src={config.address.googleMapsEmbedUrl}
              className="h-full w-full border-0"
              allowFullScreen
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
