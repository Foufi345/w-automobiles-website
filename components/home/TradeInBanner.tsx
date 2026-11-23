"use client";

import { useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { getWhatsAppUrl } from "@/lib/config";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { useGsap } from "@/hooks/useGsap";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { gsap, ScrollTrigger, SplitText } from "@/lib/gsap";
import { completeIfPastStart } from "@/lib/refreshScroll";

export function TradeInBanner() {
  const locale = useLocale();
  const t = useTranslations("home.tradeIn");
  const tWa = useTranslations("whatsapp");
  const sectionRef = useRef<HTMLElement | null>(null);
  const wipeRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const textRef = useRef<HTMLParagraphElement | null>(null);
  const buttonRef = useRef<HTMLAnchorElement | null>(null);

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

        // 1. Background wipe from left to right
        if (wipeRef.current) {
          tl.fromTo(
            wipeRef.current,
            { scaleX: 0 },
            {
              scaleX: 1,
              duration: 1.0,
              ease: "expo.out",
            }
          );
        }

        // 2. Heading reveals after wipe
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
            {
              yPercent: 0,
              opacity: 1,
              duration: 0.9,
              stagger: 0.08,
            },
            "-=0.45"
          );
        }

        // 3. Text paragraph reveals
        if (textRef.current) {
          tl.fromTo(
            textRef.current,
            { y: 24, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.8 },
            "-=0.55"
          );
        }

        // 4. WhatsApp button appears & pulses once
        if (buttonRef.current) {
          tl.fromTo(
            buttonRef.current,
            { scale: 0.92, opacity: 0 },
            { scale: 1, opacity: 1, duration: 0.55 },
            "-=0.45"
          );

          tl.to(buttonRef.current, {
            scale: 1.06,
            duration: 0.25,
            yoyo: true,
            repeat: 1,
            ease: "power2.inOut",
          });
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
        if (wipeRef.current) gsap.set(wipeRef.current, { scaleX: 1 });
        gsap.set(
          [headingRef.current, textRef.current, buttonRef.current],
          { clearProps: "all" }
        );
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
      aria-labelledby="trade-in-heading"
      className="relative isolate bg-navy-950 py-16 sm:py-24"
    >
      <div className="container-site">
        <div className="relative overflow-hidden rounded-2xl border border-navy-700 bg-navy-900 p-8 sm:p-12 lg:p-16 shadow-2xl">
          {/* Background Wipe Layer: mirrors origin in RTL */}
          <div
            ref={wipeRef}
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-r from-navy-900 via-navy-950 to-navy-900 origin-left rtl:origin-right"
          />

          {/* Subtle red accent bar */}
          <div
            aria-hidden="true"
            className="relative z-10 h-1 w-16 bg-brand-red mb-6 rounded-full"
          />

          <div
            ref={contentRef}
            className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8"
          >
            <div className="max-w-2xl">
              <h2
                ref={headingRef}
                id="trade-in-heading"
                aria-label={t("title")}
                className="font-serif text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-semibold text-ivory leading-tight"
              >
                {t("title")}
              </h2>
              <p
                ref={textRef}
                className="mt-4 text-sm sm:text-base lg:text-lg text-silver leading-relaxed font-light"
              >
                {t("description")}
              </p>
            </div>

            <div className="shrink-0">
              <a
                ref={buttonRef}
                href={getWhatsAppUrl(tWa("tradeInMessage"))}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[50px] w-full sm:w-auto items-center justify-center gap-2.5 rounded-xl bg-whatsapp-green px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-whatsapp-green/20 transition-opacity duration-200 hover:opacity-95 focus-visible:ring-2 focus-visible:ring-ivory"
              >
                <WhatsAppIcon className="h-5 w-5 shrink-0 fill-current" />
                <span>{t("cta")}</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
