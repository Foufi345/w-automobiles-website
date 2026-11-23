"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useGSAP } from "@gsap/react";
import type { Car } from "@/lib/car-types";
import { getCarPlaceholderImage } from "@/lib/cloudinary-url";
import { getLocalizedSiteConfig } from "@/lib/config";
import {
  formatCarPrice,
  formatMileageLocalized,
  formatNumber,
  formatPowerLocalized,
} from "@/lib/format";
import {
  BODY_TYPE_LABEL_KEY,
  CONDITION_LABEL_KEY,
  FUEL_LABEL_KEY,
  STATUS_LABEL_KEY,
  TRANSMISSION_LABEL_KEY,
} from "@/lib/labels";
import { translateColor } from "@/lib/colors";
import { buildCarWhatsAppUrl, getLocalizedCarUrl } from "@/lib/whatsapp";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { CarGallery } from "@/components/CarGallery";
import { CarActionButtons } from "@/components/CarActionButtons";
import { CarCard } from "@/components/CarCard";
import { gsap, ScrollTrigger, SplitText } from "@/lib/gsap";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useTransitionState } from "@/lib/transition";

interface VehicleDetailViewProps {
  car: Car;
  similarCars: Car[];
}

export function VehicleDetailView({ car, similarCars }: VehicleDetailViewProps) {
  const locale = useLocale();
  const tCar = useTranslations("car");
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const tEnums = useTranslations("enums");
  const tWa = useTranslations("whatsapp");
  const config = getLocalizedSiteConfig(locale);

  const reducedMotion = useReducedMotion();
  const { canStartEntrance } = useTransitionState();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  // Hide mobile sticky bar when virtual keyboard opens
  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;
    const vv = window.visualViewport;
    const handleResize = () => {
      setKeyboardOpen(window.innerHeight - vv.height > 150);
    };
    vv.addEventListener("resize", handleResize);
    return () => vv.removeEventListener("resize", handleResize);
  }, []);

  const pageRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const priceRef = useRef<HTMLParagraphElement | null>(null);
  const galleryWrapperRef = useRef<HTMLDivElement | null>(null);
  const specsBarRef = useRef<HTMLDivElement | null>(null);
  const specsTableRef = useRef<HTMLElement | null>(null);
  const mobileBarRef = useRef<HTMLDivElement | null>(null);

  const formattedPrice = formatCarPrice(car, locale, tCommon("priceOnRequest"));
  const formattedMileage = formatMileageLocalized(car.mileage, locale, {
    zeroNewLabel: tCommon("newZeroKm"),
  });
  const formattedPower = formatPowerLocalized(car.power, locale);
  const localizedColor = translateColor(car.color, locale);
  const fuelLabel = tEnums(FUEL_LABEL_KEY[car.fuel]);
  const transmissionLabel = tEnums(TRANSMISSION_LABEL_KEY[car.transmission]);
  const bodyTypeLabel = tEnums(BODY_TYPE_LABEL_KEY[car.bodyType]);
  const conditionLabel = tEnums(CONDITION_LABEL_KEY[car.condition]);

  const pageUrl = getLocalizedCarUrl(car.slug, locale);
  const waTemplateKey =
    car.status === "Vendu"
      ? "carInquirySold"
      : car.priceOnRequest || !car.price
        ? "carInquiryPriceOnRequest"
        : "carInquiryAvailable";
  const whatsappHref = buildCarWhatsAppUrl(car, {
    locale,
    absolutePageUrl: pageUrl,
    customMessage: tWa(waTemplateKey, {
      brand: car.brand,
      model: car.model,
      year: String(car.year),
      price: formattedPrice,
      ref: car.id.slice(0, 8),
      url: pageUrl,
    }),
  });

  const kmUnit = locale === "ar" ? " كم" : " km";
  const powerUnit = locale === "en" ? " hp" : locale === "ar" ? " حصان" : " ch";

  const keySpecs = [
    {
      label: tCar("specs.year"),
      value: String(car.year),
      num: car.year,
      suffix: "",
    },
    {
      label: tCar("specs.mileage"),
      value: formattedMileage,
      num: car.mileage,
      suffix: kmUnit,
    },
    { label: tCar("specs.fuel"), value: fuelLabel, num: null, suffix: "" },
    {
      label: tCar("specs.gearboxShort"),
      value: transmissionLabel,
      num: null,
      suffix: "",
    },
    {
      label: tCar("specs.power"),
      value: formattedPower,
      num: parseInt(car.power, 10) || null,
      suffix: /\b(ch|cv|hp)\b/i.test(car.power) ? powerUnit : "",
    },
  ];

  const fullSpecs = [
    { label: tCar("specs.brand"), value: car.brand },
    { label: tCar("specs.model"), value: car.model },
    { label: tCar("specs.productionYear"), value: String(car.year) },
    { label: tCar("specs.certifiedMileage"), value: formattedMileage },
    { label: tCar("specs.price"), value: formattedPrice },
    { label: tCar("specs.fuel"), value: fuelLabel },
    { label: tCar("specs.transmission"), value: transmissionLabel },
    { label: tCar("specs.engine"), value: car.engine },
    { label: tCar("specs.power"), value: formattedPower },
    { label: tCar("specs.color"), value: localizedColor },
    { label: tCar("specs.doors"), value: String(car.doors) },
    { label: tCar("specs.seats"), value: String(car.seats) },
    { label: tCar("specs.bodyType"), value: bodyTypeLabel },
    { label: tCar("specs.condition"), value: conditionLabel },
  ];

  // Scoped GSAP Animations: wait for transition ("idle" | "revealing"), full revert on unmount
  useGSAP(
    () => {
      if (reducedMotion || !canStartEntrance || typeof window === "undefined") {
        return;
      }

      const splits: SplitText[] = [];
      // 1. Title and price reveal with SplitText on load
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      if (titleRef.current) {
        const titleSplit = SplitText.create(titleRef.current, {
          type: "lines",
          mask: "lines",
          autoSplit: true,
          linesClass: "py-1",
        });
        splits.push(titleSplit);
        tl.fromTo(
          titleSplit.lines,
          { yPercent: 100, opacity: 0 },
          { yPercent: 0, opacity: 1, duration: 0.55, stagger: 0.05, immediateRender: true }
        );
      }

      if (priceRef.current) {
        const priceSplit = SplitText.create(priceRef.current, {
          type: "lines",
          mask: "lines",
          autoSplit: true,
          aria: "none",
          linesClass: "py-1",
        });
        splits.push(priceSplit);
        tl.fromTo(
          priceSplit.lines,
          { yPercent: 100, opacity: 0 },
          { yPercent: 0, opacity: 1, duration: 0.5, immediateRender: true },
          "-=0.4"
        );
      }

      // 2. Specs bar numbers count up on enter
      if (specsBarRef.current) {
        const specCards = specsBarRef.current.querySelectorAll(".spec-card");

        ScrollTrigger.create({
          trigger: specsBarRef.current,
          start: "top 85%",
          once: true,
          onEnter: () => {
            gsap.fromTo(
              specCards,
              { opacity: 0, y: 16 },
              { opacity: 1, y: 0, duration: 0.6, stagger: 0.06, ease: "power3.out" }
            );

            // Animate counters
            specCards.forEach((card) => {
              const numEl = card.querySelector(".spec-number-val");
              if (!numEl) return;
              const targetVal = Number(numEl.getAttribute("data-target"));
              const suffix = numEl.getAttribute("data-suffix") || "";
              if (isNaN(targetVal)) return;

              const counter = { val: 0 };
              const startVal = targetVal > 1900 ? Math.max(1990, targetVal - 30) : 0;
              counter.val = startVal;

              gsap.to(counter, {
                val: targetVal,
                duration: 1.4,
                ease: "power3.out",
                onUpdate: () => {
                  const formatted = formatNumber(Math.floor(counter.val), locale);
                  numEl.textContent = `${formatted}${suffix}`;
                },
              });
            });
          },
        });
      }

      // 3. Sequential fade-in for Full Specs Table rows (mirrors entrance direction in RTL)
      if (specsTableRef.current) {
        const isRtl = locale === "ar" || document.documentElement.dir === "rtl";
        const rows = specsTableRef.current.querySelectorAll(".spec-table-row");
        gsap.fromTo(
          rows,
          { opacity: 0, x: isRtl ? 14 : -14 },
          {
            opacity: 1,
            x: 0,
            duration: 0.5,
            stagger: 0.04,
            ease: "power3.out",
            scrollTrigger: {
              trigger: specsTableRef.current,
              start: "top 85%",
              once: true,
            },
          }
        );
      }

      // 4. Sticky mobile bar slides up after scrolling past the hero/gallery image
      if (mobileBarRef.current && galleryWrapperRef.current) {
        gsap.set(mobileBarRef.current, { y: "100%" });

        ScrollTrigger.create({
          trigger: galleryWrapperRef.current,
          start: "bottom 90px",
          onEnter: () => {
            gsap.to(mobileBarRef.current, {
              y: "0%",
              duration: 0.38,
              ease: "power3.out",
              overwrite: "auto",
            });
          },
          onLeaveBack: () => {
            gsap.to(mobileBarRef.current, {
              y: "100%",
              duration: 0.3,
              ease: "power3.in",
              overwrite: "auto",
            });
          },
        });
      }
      return () => {
        splits.forEach((s) => s.revert());
      };
    },
    { scope: pageRef, dependencies: [locale, canStartEntrance, reducedMotion], revertOnUpdate: true }
  );

  return (
    <div ref={pageRef} className="pb-24 lg:pb-16">
      <div className="container-site pt-8 sm:pt-10">
        {/* Fil d'Ariane */}
        <nav aria-label={tCar("breadcrumbLabel")} className="mb-6">
          <ol className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-silver">
            <li>
              <Link
                href="/"
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center sm:justify-start transition-colors hover:text-ivory"
              >
                {tNav("home")}
              </Link>
            </li>
            <li aria-hidden="true" className="text-navy-700 rtl:rotate-180">
              &gt;
            </li>
            <li>
              <Link
                href="/vehicules"
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center sm:justify-start transition-colors hover:text-ivory"
              >
                {tNav("vehicles")}
              </Link>
            </li>
            <li aria-hidden="true" className="text-navy-700 rtl:rotate-180">
              &gt;
            </li>
            <li
              aria-current="page"
              dir="ltr"
              className="font-medium text-ivory truncate max-w-[240px] sm:max-w-none"
            >
              {car.brand} {car.model}
            </li>
          </ol>
        </nav>

        {/* 2-Column Layout: Sticky Gallery on Desktop, Content Scrolls on Right */}
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-start">
          {/* Left Column (7 cols): Sticky Image Gallery */}
          <div className="lg:col-span-7 lg:sticky lg:top-24 space-y-6">
            <div
              ref={galleryWrapperRef}
              className={car.status === "Vendu" ? "grayscale" : undefined}
            >
              <CarGallery
                images={
                  car.images.length > 0
                    ? car.images
                    : [getCarPlaceholderImage(car.slug)]
                }
                altBase={tCar("cardImageAlt", {
                  brand: car.brand,
                  model: car.model,
                  year: String(car.year),
                })}
                onLightboxChange={setLightboxOpen}
              />
            </div>
          </div>

          {/* Right Column (5 cols): Details, CTAs, Specs, Description & Features scroll alongside */}
          <div className="lg:col-span-5 space-y-8">
            {/* Main Summary & Pricing Card */}
            <aside className="rounded-xl border border-navy-700 bg-navy-900 p-6 sm:p-7 space-y-6">
              {/* Condition + Status badge + reference */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-navy-700 bg-navy-950 px-3 py-1 text-xs font-medium uppercase tracking-wider text-silver">
                    {conditionLabel}
                  </span>
                  {car.status === "Vendu" && (
                    <span className="rounded-full border border-brand-red/80 bg-brand-red px-3 py-1 text-xs font-semibold uppercase tracking-wider text-ivory">
                      {tEnums(STATUS_LABEL_KEY.Vendu)}
                    </span>
                  )}
                  {car.status === "Réservé" && (
                    <span className="rounded-full border border-amber-400/60 bg-navy-950 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-300">
                      {tEnums(STATUS_LABEL_KEY["Réservé"])}
                    </span>
                  )}
                </div>

                <span className="text-xs text-silver">
                  {tCar("reference")}{" "}
                  <span dir="ltr" className="font-mono uppercase text-ivory/90">
                    {car.id.slice(0, 8)}
                  </span>
                </span>
              </div>

              {/* Title & Price revealed with SplitText */}
              <div>
                <h1
                  ref={titleRef}
                  className="font-serif text-2xl sm:text-3xl lg:text-4xl font-semibold text-ivory leading-tight text-start"
                >
                  <bdi dir="ltr">
                    {car.brand} {car.model} {car.year}
                  </bdi>
                </h1>
                <p className="mt-1.5 text-sm text-silver">
                  {car.engine} &middot; {localizedColor}
                </p>

                <div className="mt-5 border-t border-navy-700/70 pt-5">
                  <p className="text-xs uppercase tracking-wider text-silver">
                    {car.priceOnRequest
                      ? tCar("tariff")
                      : tCar("priceDisplayed")}
                  </p>
                  <p
                    ref={priceRef}
                    className="mt-1 font-serif text-3xl sm:text-4xl font-semibold text-ivory"
                  >
                    <bdi>{formattedPrice}</bdi>
                  </p>
                </div>
              </div>

              {/* WhatsApp CTA (Magnetic hover) + Call & Share */}
              <CarActionButtons
                car={{
                  id: car.id,
                  slug: car.slug,
                  brand: car.brand,
                  model: car.model,
                  year: car.year,
                  price: car.price,
                  priceOnRequest: car.priceOnRequest,
                  status: car.status,
                }}
              />

              {/* Reassurance pill */}
              <div className="border-t border-navy-700/70 pt-4 text-xs text-silver space-y-1.5">
                <p className="font-medium text-ivory">
                  {tCar("visibleAtShowroom", { name: config.name })}
                </p>
                <p>{config.address.full}</p>
                <p>{config.hours.full}</p>
              </div>
            </aside>

            {/* Key Specs Bar: horizontally scrollable on phones, grid from sm+ */}
            <section
              aria-label={tCar("keySpecsLabel")}
              ref={specsBarRef}
            >
              <div className="flex flex-nowrap gap-3 overflow-x-auto pb-1 sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0">
                {keySpecs.map((spec) => (
                  <div
                    key={spec.label}
                    className="spec-card min-w-[132px] shrink-0 sm:min-w-0 rounded-xl border border-navy-700 bg-navy-900 px-3.5 py-3 transition-colors hover:border-silver/40"
                  >
                    <p className="text-[11px] font-medium uppercase tracking-wider text-silver">
                      {spec.label}
                    </p>
                    <p className="mt-1 font-serif text-base sm:text-lg font-semibold text-ivory truncate">
                      {spec.num !== null ? (
                        <span
                          className="spec-number-val"
                          data-target={spec.num}
                          data-suffix={spec.suffix}
                        >
                          {spec.value}
                        </span>
                      ) : (
                        spec.value
                      )}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* Presentation du véhicule (collapsible on mobile, open by default) */}
            <details
              open
              className="group rounded-xl border border-navy-700 bg-navy-900 p-5 sm:p-7"
            >
              <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-2 font-serif text-xl sm:text-2xl font-semibold text-ivory">
                <span id="car-description-heading">
                  {tCar("descriptionHeading")}
                </span>
                <span
                  aria-hidden="true"
                  className="text-sm text-silver transition-transform group-open:rotate-180 sm:hidden"
                >
                  &#9662;
                </span>
              </summary>
              <p
                dir="auto"
                className="mt-3 text-base leading-relaxed text-silver prose-measure"
              >
                {car.description}
              </p>
            </details>

            {/* Équipements & options (collapsible on mobile) */}
            <details
              open
              className="group rounded-xl border border-navy-700 bg-navy-900 p-5 sm:p-7"
            >
              <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-2 font-serif text-xl sm:text-2xl font-semibold text-ivory">
                <span id="car-features-heading">
                  {tCar("featuresHeading")}
                </span>
                <span
                  aria-hidden="true"
                  className="text-sm text-silver transition-transform group-open:rotate-180 sm:hidden"
                >
                  &#9662;
                </span>
              </summary>

              <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {car.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2.5 text-sm text-ivory/90"
                  >
                    <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-brand-red/50 bg-brand-red/15 text-brand-red">
                      <svg
                        aria-hidden="true"
                        className="h-3 w-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="m4.5 12.75 6 6 9-13.5"
                        />
                      </svg>
                    </span>
                    <span className="leading-snug text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
            </details>

            {/* Fiche technique complète (2-column grid on mobile & desktop) */}
            <section
              ref={specsTableRef}
              aria-labelledby="car-specs-table-heading"
              className="rounded-xl border border-navy-700 bg-navy-900 p-5 sm:p-7"
            >
              <h2
                id="car-specs-table-heading"
                className="font-serif text-xl sm:text-2xl font-semibold text-ivory"
              >
                {tCar("fullSpecsHeading")}
              </h2>

              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                {fullSpecs.map((row) => (
                  <div
                    key={row.label}
                    className="spec-table-row rounded-lg border border-navy-700/60 bg-navy-950/60 p-3 min-w-0"
                  >
                    <dt className="text-[11px] uppercase tracking-wider text-silver">
                      {row.label}
                    </dt>
                    <dd className="mt-1 font-medium text-ivory text-xs sm:text-sm break-words">
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>
        </div>

        {/* Similar Vehicles: horizontal snap carousel on phones, grid on md+ */}
        {similarCars.length > 0 && (
          <section
            aria-labelledby="similar-cars-heading"
            className="mt-16 border-t border-navy-700/80 pt-14"
          >
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-silver">
                  {tCar("similarEyebrow")}
                </p>
                <h2
                  id="similar-cars-heading"
                  className="mt-1 font-serif text-2xl sm:text-3xl font-semibold text-ivory"
                >
                  {tCar("similarHeading")}
                </h2>
              </div>

              <Link
                href="/vehicules"
                className="inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-silver transition-colors hover:text-ivory"
              >
                <span>{tCar("allCatalogue")}</span>
                <span aria-hidden="true" className="rtl:rotate-180">
                  &rarr;
                </span>
              </Link>
            </div>

            <div className="flex flex-nowrap gap-4 overflow-x-auto pb-2 snap-x snap-mandatory md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-6 md:overflow-visible md:pb-0">
              {similarCars.map((simCar) => (
                <div
                  key={simCar.id}
                  className="w-[82vw] max-w-[340px] shrink-0 snap-start md:w-auto md:max-w-none"
                >
                  <CarCard car={simCar} />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Sticky Bottom Bar on Mobile (Price + WhatsApp + Call), safe-area aware, hides when keyboard or lightbox open */}
      <div
        ref={mobileBarRef}
        className={`fixed inset-x-0 bottom-0 z-40 border-t border-navy-700 bg-navy-950/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden transition-none ${lightboxOpen || keyboardOpen ? "hidden" : ""
          }`}
      >
        <div className="mx-auto flex max-w-container items-center justify-between gap-2.5">
          <div className="min-w-0">
            <p className="truncate text-[11px] uppercase tracking-wider text-silver">
              {car.brand} {car.model}
            </p>
            <p className="truncate font-serif text-base sm:text-lg font-semibold text-ivory">
              {formattedPrice}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href={`tel:${config.contact.phone.replace(/[^0-9+]/g, "")}`}
              aria-label={tCommon("callBrand", { brand: config.name })}
              className="inline-flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-navy-700 bg-navy-900 text-ivory hover:border-silver/50"
            >
              <svg
                aria-hidden="true"
                className="h-5 w-5 text-brand-red"
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
            </a>

            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-whatsapp-green px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-sm"
            >
              <WhatsAppIcon className="h-4 w-4 shrink-0 fill-current text-white" />
              <span>{tCommon("whatsapp")}</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
