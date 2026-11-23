"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Car } from "@/lib/car-types";
import { siteConfig } from "@/lib/config";
import { formatCarPrice } from "@/lib/format";
import { buildCarWhatsAppUrl, getLocalizedCarUrl } from "@/lib/whatsapp";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { gsap } from "@/lib/gsap";

interface CarActionButtonsProps {
  car: Pick<
    Car,
    | "id"
    | "slug"
    | "brand"
    | "model"
    | "year"
    | "price"
    | "priceOnRequest"
    | "status"
  >;
}

let lastAnnouncement = "";

export function CarActionButtons({ car }: CarActionButtonsProps) {
  const locale = useLocale();
  const tCar = useTranslations("car");
  const tCommon = useTranslations("common");
  const tWa = useTranslations("whatsapp");

  const [pageUrl, setPageUrl] = useState(getLocalizedCarUrl(car.slug, locale));
  const [shareState, setShareState] = useState<"idle" | "copied" | "failed">(
    "idle"
  );
  const [liveMessage, setLiveMessage] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const whatsappBtnRef = useRef<HTMLAnchorElement | null>(null);

  // Subtle magnetic hover effect on desktop
  useEffect(() => {
    const btn = whatsappBtnRef.current;
    if (
      !btn ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      window.matchMedia("(pointer: coarse)").matches
    ) {
      return;
    }

    const xTo = gsap.quickTo(btn, "x", { duration: 0.35, ease: "power2.out" });
    const yTo = gsap.quickTo(btn, "y", { duration: 0.35, ease: "power2.out" });

    const handleMouseMove = (e: MouseEvent) => {
      const rect = btn.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = (e.clientX - centerX) * 0.22;
      const dy = (e.clientY - centerY) * 0.22;
      xTo(Math.max(-8, Math.min(8, dx)));
      yTo(Math.max(-8, Math.min(8, dy)));
    };

    const handleMouseLeave = () => {
      xTo(0);
      yTo(0);
    };

    btn.addEventListener("mousemove", handleMouseMove);
    btn.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      btn.removeEventListener("mousemove", handleMouseMove);
      btn.removeEventListener("mouseleave", handleMouseLeave);
      gsap.set(btn, { x: 0, y: 0 });
    };
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setPageUrl(window.location.href);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const priceText = formatCarPrice(car, locale, tCommon("priceOnRequest"));
  const waTemplateKey =
    car.status === "Vendu"
      ? "carInquirySold"
      : car.priceOnRequest || !car.price
        ? "carInquiryPriceOnRequest"
        : "carInquiryAvailable";

  const waMessage = tWa(waTemplateKey, {
    brand: car.brand,
    model: car.model,
    year: String(car.year),
    price: priceText,
    ref: car.id.slice(0, 8),
    url: pageUrl,
  });

  const whatsappUrl = buildCarWhatsAppUrl(car, {
    locale,
    absolutePageUrl: pageUrl,
    customMessage: waMessage,
  });

  const carTitle = `${car.brand} ${car.model} (${car.year})`;

  const reportCopyOutcome = (ok: boolean) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    let msg = ok ? tCommon("linkCopied") : tCommon("copyFailed");
    if (msg === lastAnnouncement) {
      msg += "\u00A0";
    }
    lastAnnouncement = msg;

    setShareState(ok ? "copied" : "failed");
    setLiveMessage(msg);

    timerRef.current = setTimeout(() => {
      setShareState("idle");
      setLiveMessage("");
    }, 2400);
  };

  const handleShare = async () => {
    const shareUrl =
      typeof window !== "undefined" ? window.location.href : pageUrl;

    if (
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function"
    ) {
      try {
        await navigator.share({
          title: `${carTitle} — ${siteConfig.name}`,
          text: tCar("shareText", { title: carTitle, name: siteConfig.name }),
          url: shareUrl,
        });
        return;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      reportCopyOutcome(true);
    } catch {
      reportCopyOutcome(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Primary CTA: Demander sur WhatsApp */}
      <a
        ref={whatsappBtnRef}
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-h-[50px] w-full items-center justify-center gap-2.5 rounded-xl bg-whatsapp-green px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-95"
      >
        <WhatsAppIcon className="h-5 w-5 shrink-0 fill-current text-white" />
        <span>{tCar("askOnWhatsApp")}</span>
      </a>

      {/* Secondary buttons: Appeler & Partager */}
      <div className="grid grid-cols-2 gap-3">
        <a
          href={`tel:${siteConfig.contact.phone.replace(/[^0-9+]/g, "")}`}
          className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl border border-navy-700 bg-navy-950 px-4 py-2.5 text-sm font-medium text-ivory transition-colors hover:border-silver/50"
        >
          <svg
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-brand-red"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.75}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z"
            />
          </svg>
          <span>{tCommon("call")}</span>
        </a>

        {/* Share button + external live status region */}
        <div className="relative">
          <button
            type="button"
            onClick={handleShare}
            data-copied={shareState === "copied" ? "" : undefined}
            data-failed={shareState === "failed" ? "" : undefined}
            className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl border border-navy-700 bg-navy-950 px-4 py-2.5 text-sm font-medium text-ivory transition-colors hover:border-silver/50"
          >
            {shareState === "copied" ? (
              <svg
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-emerald-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m4.5 12.75 6 6 9-13.5"
                />
              </svg>
            ) : (
              <svg
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-silver"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.75}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z"
                />
              </svg>
            )}
            <span>
              {shareState === "copied"
                ? tCommon("linkCopied")
                : shareState === "failed"
                  ? tCommon("error")
                  : tCommon("share")}
            </span>
          </button>

          <span
            role="status"
            className={`pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-navy-700 bg-navy-900 px-2.5 py-1 text-xs text-ivory shadow-md transition-opacity duration-150 ${
              liveMessage ? "opacity-100" : "opacity-0"
            }`}
          >
            {liveMessage}
          </span>
        </div>
      </div>
    </div>
  );
}
