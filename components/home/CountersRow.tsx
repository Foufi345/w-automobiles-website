"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { useGsap } from "@/hooks/useGsap";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { gsap, ScrollTrigger } from "@/lib/gsap";

interface CountersRowProps {
  totalCars: number;
  totalBrands: number;
}

export function CountersRow({ totalCars, totalBrands }: CountersRowProps) {
  const t = useTranslations("home.counters");
  const sectionRef = useRef<HTMLElement | null>(null);
  const count1Ref = useRef<HTMLSpanElement | null>(null);
  const count2Ref = useRef<HTMLSpanElement | null>(null);

  const isReducedMotion = useReducedMotion();

  useGsap(
    () => {
      const section = sectionRef.current;
      if (!section) return;

      const setFinalNumbers = () => {
        if (count1Ref.current) count1Ref.current.textContent = `${totalBrands}+`;
        if (count2Ref.current) count2Ref.current.textContent = `${totalCars}`;
      };

      if (isReducedMotion) {
        setFinalNumbers();
        return;
      }

      const obj = { val1: 0, val2: 0 };
      let hasRun = false;

      const runCount = () => {
        if (hasRun) return;
        hasRun = true;
        gsap.to(obj, {
          val1: totalBrands,
          val2: totalCars,
          duration: 1.5,
          ease: "power3.out",
          onUpdate: () => {
            if (count1Ref.current) {
              count1Ref.current.textContent = `${Math.round(obj.val1)}+`;
            }
            if (count2Ref.current) {
              count2Ref.current.textContent = `${Math.round(obj.val2)}`;
            }
          },
          onComplete: setFinalNumbers,
        });
      };

      ScrollTrigger.create({
        trigger: section,
        start: "top 85%",
        once: true,
        onEnter: runCount,
        onRefresh: (st) => {
          if (st.progress > 0 || window.scrollY >= st.start) {
            hasRun = true;
            setFinalNumbers();
          }
        },
      });
    },
    { scope: sectionRef, dependencies: [isReducedMotion, totalBrands, totalCars] }
  );

  return (
    <section
      ref={sectionRef}
      aria-label={t("sectionLabel")}
      className="relative isolate border-b border-navy-700/60 bg-navy-950 py-12 sm:py-16"
    >
      <div className="container-site">
        <div className="grid grid-cols-3 gap-2 sm:gap-8 rounded-2xl border border-navy-700 bg-navy-900 p-4 sm:p-8">
          {/* Counter 1: Real brands count */}
          <div className="flex min-w-0 flex-col items-center sm:items-start text-center sm:text-start">
            <span
              ref={count1Ref}
              dir="ltr"
              className="font-serif text-2xl sm:text-5xl lg:text-6xl font-semibold text-ivory tracking-tight"
            >
              {totalBrands}+
            </span>
            <span className="mt-1 text-[11px] sm:text-sm uppercase tracking-wider text-silver font-medium leading-tight">
              {t("brandsLabel")}
            </span>
            <p className="hidden sm:block mt-1 text-xs text-silver/80 font-light">
              {t("brandsSub")}
            </p>
          </div>

          {/* Counter 2: Real available vehicles count */}
          <div className="flex min-w-0 flex-col items-center sm:items-start text-center sm:text-start border-x border-navy-700/70 px-2 sm:px-8">
            <span
              ref={count2Ref}
              dir="ltr"
              className="font-serif text-2xl sm:text-5xl lg:text-6xl font-semibold text-ivory tracking-tight"
            >
              {totalCars}
            </span>
            <span className="mt-1 text-[11px] sm:text-sm uppercase tracking-wider text-silver font-medium leading-tight">
              {t("vehiclesLabel")}
            </span>
            <p className="hidden sm:block mt-1 text-xs text-silver/80 font-light">
              {t("vehiclesSub")}
            </p>
          </div>

          {/* Item 3: Reprise immédiate with icon */}
          <div className="flex min-w-0 flex-col items-center sm:items-start text-center sm:text-start sm:ps-4">
            <div className="inline-flex h-8 w-8 sm:h-12 sm:w-12 items-center justify-center rounded-xl border border-brand-red/30 bg-navy-950 text-brand-red">
              <svg
                aria-hidden="true"
                width="24"
                height="24"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
                />
              </svg>
            </div>
            <span className="mt-3 text-sm sm:text-base uppercase tracking-wider text-ivory font-semibold">
              {t("tradeInLabel")}
            </span>
            <p className="mt-1 text-xs text-silver/80 font-light">
              {t("tradeInSub")}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
