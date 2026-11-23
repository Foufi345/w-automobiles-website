"use client";

import { useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useGsap } from "@/hooks/useGsap";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { gsap, ScrollTrigger, SplitText } from "@/lib/gsap";
import { completeIfPastStart } from "@/lib/refreshScroll";

const WHY_CHOOSE_US_ITEMS = [
  {
    key: "choice" as const,
    pathD:
      "M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.948c0-.621-.504-1.125-1.125-1.125H4.125C3.504 5.5 3 6.004 3 6.625v7.625",
  },
  {
    key: "tradeIn" as const,
    pathD:
      "M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99",
  },
  {
    key: "verified" as const,
    pathD:
      "M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z",
  },
  {
    key: "support" as const,
    pathD:
      "M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z",
  },
];

export function WhyChooseUsSection() {
  const locale = useLocale();
  const t = useTranslations("home.whyChooseUs");
  const sectionRef = useRef<HTMLElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const paragraphRef = useRef<HTMLParagraphElement | null>(null);
  const cardsContainerRef = useRef<HTMLDivElement | null>(null);

  const isReducedMotion = useReducedMotion();

  useGsap(
    () => {
      const section = sectionRef.current;
      if (!section) return;

      let split: SplitText | null = null;

      // 1. Clean CSS variable boundary transitions on <body> (--bg, --fg)
      // Section itself has solid bg-ivory so there is never a grey wash-out or veil
      if (!isReducedMotion) {
        gsap.fromTo(
          document.body,
          { "--bg": "#0B121A", "--fg": "#F4F1EC" },
          {
            "--bg": "#F4F1EC",
            "--fg": "#0B121A",
            ease: "none",
            scrollTrigger: {
              trigger: section,
              start: "top 70%",
              end: "top 30%",
              scrub: true,
              onLeave: () =>
                gsap.set(document.body, { "--bg": "#F4F1EC", "--fg": "#0B121A" }),
              onLeaveBack: () =>
                gsap.set(document.body, { "--bg": "#0B121A", "--fg": "#F4F1EC" }),
            },
          }
        );

        gsap.fromTo(
          document.body,
          { "--bg": "#F4F1EC", "--fg": "#0B121A" },
          {
            "--bg": "#0B121A",
            "--fg": "#F4F1EC",
            ease: "none",
            immediateRender: false,
            scrollTrigger: {
              trigger: section,
              start: "bottom 70%",
              end: "bottom 30%",
              scrub: true,
              onLeave: () =>
                gsap.set(document.body, { "--bg": "#0B121A", "--fg": "#F4F1EC" }),
              onLeaveBack: () =>
                gsap.set(document.body, { "--bg": "#F4F1EC", "--fg": "#0B121A" }),
            },
          }
        );
      }

      // 2. Section title & subtitle reveal (once: true + onRefresh fail-safe)
      if (headingRef.current) {
        if (!isReducedMotion) {
          split = SplitText.create(headingRef.current, {
            type: "lines",
            mask: "lines",
            autoSplit: true,
            linesClass: "py-1",
          });

          const headerTl = gsap.timeline({
            paused: true,
            defaults: { ease: "power3.out" },
          });

          headerTl.fromTo(
            split.lines,
            { yPercent: 110, opacity: 0 },
            { yPercent: 0, opacity: 1, duration: 0.9, stagger: 0.08 }
          );

          if (paragraphRef.current) {
            headerTl.fromTo(
              paragraphRef.current,
              { y: 24, opacity: 0 },
              { y: 0, opacity: 1, duration: 0.8 },
              "-=0.6"
            );
          }

          ScrollTrigger.create({
            trigger: headingRef.current,
            start: "top 85%",
            once: true,
            onEnter: (st) => {
              if (Math.abs(st.getVelocity()) > 1200 || window.scrollY > st.end) {
                headerTl.progress(1);
              } else {
                headerTl.play();
              }
            },
            onRefresh: (st) => completeIfPastStart(headerTl, st),
          });
        } else {
          gsap.set([headingRef.current, paragraphRef.current], {
            clearProps: "all",
          });
        }
      }

      // 3. Cards stagger (3deg -> 0) + SVG icon stroke draw (once: true + onRefresh fail-safe)
      if (cardsContainerRef.current) {
        const cards = cardsContainerRef.current.querySelectorAll(".why-card");
        const pathElements =
          cardsContainerRef.current.querySelectorAll(".icon-path");

        if (!isReducedMotion) {
          pathElements.forEach((path) => {
            const svgPath = path as SVGPathElement;
            const length = svgPath.getTotalLength() || 150;
            gsap.set(svgPath, {
              strokeDasharray: length,
              strokeDashoffset: length,
            });
          });

          const cardsTl = gsap.timeline({
            paused: true,
            defaults: { ease: "power3.out" },
          });

          cardsTl.fromTo(
            cards,
            { y: 45, rotation: 3, opacity: 0 },
            {
              y: 0,
              rotation: 0,
              opacity: 1,
              duration: 0.9,
              stagger: 0.1,
              clearProps: "transform",
            }
          );

          cardsTl.to(
            pathElements,
            {
              strokeDashoffset: 0,
              duration: 1.0,
              stagger: 0.1,
              ease: "power2.out",
            },
            "-=0.7"
          );

          ScrollTrigger.create({
            trigger: cardsContainerRef.current,
            start: "top 85%",
            once: true,
            onEnter: (st) => {
              if (Math.abs(st.getVelocity()) > 1200 || window.scrollY > st.end) {
                cardsTl.progress(1);
              } else {
                cardsTl.play();
              }
            },
            onRefresh: (st) => completeIfPastStart(cardsTl, st),
          });
        } else {
          gsap.set(cards, { clearProps: "all" });
          gsap.set(pathElements, { strokeDashoffset: 0, clearProps: "all" });
        }
      }

      return () => {
        split?.revert();
        gsap.set(document.body, { "--bg": "#0B121A", "--fg": "#F4F1EC" });
      };
    },
    { scope: sectionRef, dependencies: [locale, isReducedMotion], revertOnUpdate: true }
  );

  return (
    <section
      ref={sectionRef}
      aria-labelledby="why-choose-us-heading"
      className="relative isolate bg-ivory text-navy-950 py-20 sm:py-28"
    >
      <div className="container-site">
        <div className="max-w-2xl">
          <p
            ref={paragraphRef}
            className="text-xs font-semibold uppercase tracking-widest text-slate-600"
          >
            {t("eyebrow")}
          </p>
          <h2
            ref={headingRef}
            id="why-choose-us-heading"
            aria-label={t("title")}
            className="mt-2 font-serif text-3xl sm:text-4xl lg:text-5xl font-semibold text-navy-950"
          >
            {t("title")}
          </h2>
        </div>

        <div
          ref={cardsContainerRef}
          className="mt-12 grid grid-cols-1 gap-6 min-[600px]:grid-cols-2 lg:grid-cols-4"
        >
          {WHY_CHOOSE_US_ITEMS.map((item) => (
            <div
              key={item.key}
              className="why-card flex flex-col rounded-2xl border border-navy-950/10 bg-white p-7 shadow-sm"
            >
              <div className="inline-flex h-13 w-13 items-center justify-center rounded-xl border border-navy-950/15 bg-ivory p-3.5 shrink-0">
                <svg
                  aria-hidden="true"
                  width="24"
                  height="24"
                  className="h-6 w-6 text-brand-red overflow-visible"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.8}
                >
                  <path
                    className="icon-path"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d={item.pathD}
                  />
                </svg>
              </div>

              <h3 className="mt-6 font-serif text-xl sm:text-2xl font-semibold text-navy-950">
                {t(`items.${item.key}.title`)}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 font-light">
                {t(`items.${item.key}.description`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
