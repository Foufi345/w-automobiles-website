"use client";

import { cldUrl } from "@/lib/cloudinary-url";
import { formatCarPrice, formatMileageLocalized } from "@/lib/format";
import type {
  CarCondition,
  CarImage,
  CarStatus,
  FuelType,
  TransmissionType,
} from "@/types/database";

export type PreviewLocale = "fr" | "en" | "ar";

interface CarPreviewCardProps {
  brand: string;
  model: string;
  year: number;
  price: number | null;
  priceOnRequest: boolean;
  mileage: number;
  fuel: FuelType;
  transmission: TransmissionType;
  condition: CarCondition;
  status: CarStatus;
  published: boolean;
  images: CarImage[];
  previewLocale?: PreviewLocale;
}

const PREVIEW_LABELS: Record<
  PreviewLocale,
  {
    draft: string;
    priceLabel: string;
    priceOnRequest: string;
    viewDetails: string;
    brandFallback: string;
    modelFallback: string;
    fuel: Record<FuelType, string>;
    transmission: Record<TransmissionType, string>;
    condition: Record<CarCondition, string>;
    status: Record<CarStatus, string>;
  }
> = {
  fr: {
    draft: "Brouillon",
    priceLabel: "Prix",
    priceOnRequest: "Prix sur demande",
    viewDetails: "Voir la fiche",
    brandFallback: "Marque",
    modelFallback: "Modèle",
    fuel: {
      Essence: "Essence",
      Diesel: "Diesel",
      Hybride: "Hybride",
      Électrique: "Électrique",
      GPL: "GPL",
    },
    transmission: {
      Automatique: "Automatique",
      Manuelle: "Manuelle",
    },
    condition: {
      Neuf: "Neuf",
      Occasion: "Occasion",
    },
    status: {
      Disponible: "Disponible",
      Réservé: "Réservé",
      Vendu: "Vendu",
    },
  },
  en: {
    draft: "Draft",
    priceLabel: "Price",
    priceOnRequest: "Price on request",
    viewDetails: "View details",
    brandFallback: "Brand",
    modelFallback: "Model",
    fuel: {
      Essence: "Petrol",
      Diesel: "Diesel",
      Hybride: "Hybrid",
      Électrique: "Electric",
      GPL: "LPG",
    },
    transmission: {
      Automatique: "Automatic",
      Manuelle: "Manual",
    },
    condition: {
      Neuf: "New",
      Occasion: "Pre-owned",
    },
    status: {
      Disponible: "Available",
      Réservé: "Reserved",
      Vendu: "Sold",
    },
  },
  ar: {
    draft: "مسودة",
    priceLabel: "السعر",
    priceOnRequest: "السعر عند الطلب",
    viewDetails: "عرض التفاصيل",
    brandFallback: "الماركة",
    modelFallback: "الموديل",
    fuel: {
      Essence: "بنزين",
      Diesel: "ديزل",
      Hybride: "هجين",
      Électrique: "كهربائي",
      GPL: "غاز (GPL)",
    },
    transmission: {
      Automatique: "أوتوماتيك",
      Manuelle: "يدوي",
    },
    condition: {
      Neuf: "جديد",
      Occasion: "مستعمل",
    },
    status: {
      Disponible: "متوفر",
      Réservé: "محجوز",
      Vendu: "مباع",
    },
  },
};

/**
 * Plain live preview mirroring the public <CarCard /> design (zero motion, zero WebGL).
 * Follows the selected language tab in the admin form (FR / EN / AR with RTL).
 */
export function CarPreviewCard({
  brand,
  model,
  year,
  price,
  priceOnRequest,
  mileage,
  fuel,
  transmission,
  condition,
  status,
  published,
  images,
  previewLocale = "fr",
}: CarPreviewCardProps) {
  const copy = PREVIEW_LABELS[previewLocale];
  const isRtl = previewLocale === "ar";

  const firstImage = images[0];
  const coverSrc = firstImage?.url?.includes("res.cloudinary.com/")
    ? cldUrl(firstImage.url, { width: 640 })
    : firstImage?.public_id
      ? cldUrl(firstImage.public_id, { width: 640 })
      : firstImage?.url || "/images/showroom-hero.jpg";

  const mileageLabel = formatMileageLocalized(mileage, previewLocale, {
    compact: true,
  });
  const priceText = formatCarPrice(
    {
      price: price ?? 0,
      priceOnRequest,
    },
    previewLocale,
    copy.priceOnRequest
  );

  return (
    <article
      dir={isRtl ? "rtl" : "ltr"}
      lang={previewLocale}
      className="flex flex-col overflow-hidden rounded-xl border border-navy-700 bg-navy-900 shadow-sm"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden border-b border-navy-700/70 bg-navy-950">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={coverSrc}
          alt={`${brand || copy.brandFallback} ${model || copy.modelFallback}`}
          className={`h-full w-full object-cover ${
            status === "Vendu" ? "grayscale opacity-90" : ""
          }`}
        />

        <div className="pointer-events-none absolute inset-x-3 top-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {!published && (
              <span className="rounded-full border border-navy-700 bg-navy-950/90 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-silver">
                {copy.draft}
              </span>
            )}
            {status === "Vendu" && (
              <span className="rounded-full border border-brand-red/80 bg-brand-red px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-ivory">
                {copy.status.Vendu}
              </span>
            )}
            {status === "Réservé" && (
              <span className="rounded-full border border-amber-400/60 bg-navy-950/90 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-amber-300">
                {copy.status["Réservé"]}
              </span>
            )}
          </div>
          <span className="rounded-full border border-navy-700/80 bg-navy-950/85 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-silver">
            {copy.condition[condition]}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col">
        <div className="px-5 pt-5">
          <p className="text-xs font-medium uppercase tracking-widest text-silver">
            <span dir="ltr">{brand || copy.brandFallback}</span> &middot;{" "}
            {year || new Date().getFullYear()}
          </p>
          <h3
            dir="ltr"
            className="mt-1 font-serif text-xl font-semibold text-ivory leading-snug text-start"
          >
            {brand || copy.brandFallback} {model || copy.modelFallback}
          </h3>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 px-5">
          <span className="inline-flex items-center rounded-lg border border-navy-700/80 bg-navy-950/70 px-2.5 py-1 text-xs text-silver">
            {mileageLabel}
          </span>
          <span className="inline-flex items-center rounded-lg border border-navy-700/80 bg-navy-950/70 px-2.5 py-1 text-xs text-silver">
            {copy.fuel[fuel]}
          </span>
          <span className="inline-flex items-center rounded-lg border border-navy-700/80 bg-navy-950/70 px-2.5 py-1 text-xs text-silver">
            {copy.transmission[transmission]}
          </span>
        </div>

        <div className="mt-auto flex items-end justify-between gap-3 border-t border-navy-700/60 px-5 py-4 mt-5">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-silver">
              {copy.priceLabel}
            </p>
            <p className="mt-0.5 font-serif text-lg font-semibold text-ivory">
              <bdi>{priceText}</bdi>
            </p>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-ivory">
            <span>{copy.viewDetails}</span>
            <span
              aria-hidden="true"
              className="text-brand-red rtl:rotate-180"
            >
              &rarr;
            </span>
          </span>
        </div>
      </div>
    </article>
  );
}
