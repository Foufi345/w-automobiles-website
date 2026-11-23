"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Car } from "@/lib/car-types";
import { getCarPlaceholderImage } from "@/lib/cloudinary-url";
import { formatCarPrice, formatMileageLocalized } from "@/lib/format";
import {
  CONDITION_LABEL_KEY,
  FUEL_LABEL_KEY,
  STATUS_LABEL_KEY,
  TRANSMISSION_LABEL_KEY,
} from "@/lib/labels";
import { DistortImage } from "@/components/webgl/DistortImage";

interface CarCardProps {
  car: Car;
  priority?: boolean;
}

export function CarCard({ car, priority = false }: CarCardProps) {
  const locale = useLocale();
  const tCar = useTranslations("car");
  const tCommon = useTranslations("common");
  const tEnums = useTranslations("enums");

  const coverImage = car.images[0] ?? getCarPlaceholderImage(car.slug);
  const carTitle = `${car.brand} ${car.model}`;
  const detailHref = `/vehicules/${car.slug}`;

  const mileageLabel = formatMileageLocalized(car.mileage, locale, {
    compact: true,
  });

  return (
    <article
      data-flip-id={car.id}
      className="car-card group relative flex h-full flex-col overflow-hidden rounded-xl border border-navy-700 bg-navy-900 shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-silver/40 hover:shadow-md"
    >
      {/* Media region: fixed 4:3 aspect ratio so layout never depends on image load */}
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "4 / 3",
          overflow: "hidden",
        }}
        className="relative aspect-[4/3] w-full shrink-0 overflow-hidden border-b border-navy-700/70 bg-navy-950"
      >
        <DistortImage
          src={coverImage}
          slug={car.slug}
          alt={tCar("cardImageAlt", {
            brand: car.brand,
            model: car.model,
            year: String(car.year),
          })}
          priority={priority}
          aspectRatio="aspect-[4/3]"
          className={car.status === "Vendu" ? "grayscale opacity-90" : ""}
          sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 440px"
        />

        {/* Status & Condition badges */}
        <div className="pointer-events-none absolute inset-x-3 top-3 flex items-center justify-between gap-2">
          <div>
            {car.status === "Vendu" && (
              <span className="rounded-full border border-brand-red/80 bg-brand-red px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-ivory shadow-sm">
                {tEnums(STATUS_LABEL_KEY.Vendu)}
              </span>
            )}
            {car.status === "Réservé" && (
              <span className="rounded-full border border-amber-400/60 bg-navy-950/90 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-amber-300 backdrop-blur-sm">
                {tEnums(STATUS_LABEL_KEY["Réservé"])}
              </span>
            )}
          </div>
          <span className="rounded-full border border-navy-700/80 bg-navy-950/85 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-silver backdrop-blur-sm">
            {tEnums(CONDITION_LABEL_KEY[car.condition])}
          </span>
        </div>
      </div>

      {/* Card body: flex-1 so price/CTA row pins to bottom uniformly across rows */}
      <div className="flex flex-1 flex-col">
        {/* Header region */}
        <header className="px-5 pt-5">
          <p className="text-xs font-medium uppercase tracking-widest text-silver">
            <span dir="ltr">{car.brand}</span> &middot; {car.year}
          </p>
          <h3 className="mt-1 font-serif text-xl sm:text-2xl font-semibold text-ivory leading-snug text-start">
            <Link
              href={detailHref}
              className="card-primary-link focus:outline-none after:absolute after:inset-0 inline-block"
            >
              <bdi dir="ltr">{carTitle}</bdi>
            </Link>
          </h3>
        </header>

        {/* Spec chips: flex-wrap with gap, no fixed width, no ellipsis truncation */}
        <dl className="flex flex-wrap gap-2 px-5 pt-4 pb-5 text-xs text-silver">
          <div className="rounded-lg border border-navy-700/70 bg-navy-950/60 px-2.5 py-1.5">
            <dt className="sr-only">{tCar("specs.mileage")}</dt>
            <dd className="whitespace-nowrap font-medium text-ivory/90">
              {mileageLabel}
            </dd>
          </div>
          <div className="rounded-lg border border-navy-700/70 bg-navy-950/60 px-2.5 py-1.5">
            <dt className="sr-only">{tCar("specs.fuel")}</dt>
            <dd className="whitespace-nowrap font-medium text-ivory/90">
              {tEnums(FUEL_LABEL_KEY[car.fuel])}
            </dd>
          </div>
          <div className="rounded-lg border border-navy-700/70 bg-navy-950/60 px-2.5 py-1.5">
            <dt className="sr-only">{tCar("specs.gearbox")}</dt>
            <dd className="whitespace-nowrap font-medium text-ivory/90">
              {tEnums(TRANSMISSION_LABEL_KEY[car.transmission])}
            </dd>
          </div>
        </dl>

        {/* Footer region: pinned to bottom with mt-auto */}
        <footer className="mt-auto flex items-center justify-between gap-3 border-t border-navy-700/70 px-5 py-4">
          <div>
            <span className="block text-[11px] uppercase tracking-wider text-silver">
              {tCar("priceLabel")}
            </span>
            <span className="font-serif text-lg sm:text-xl font-semibold text-ivory">
              <bdi>{formatCarPrice(car, locale, tCommon("priceOnRequest"))}</bdi>
            </span>
          </div>

          <span
            aria-hidden="true"
            className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-ivory transition-colors group-hover:text-silver"
          >
            <span>{tCar("viewDetails")}</span>
            <span className="text-brand-red transition-transform duration-200 group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1">
              &rarr;
            </span>
          </span>
        </footer>
      </div>
    </article>
  );
}
