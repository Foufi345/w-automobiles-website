import type { AppLocale } from "@/i18n/routing";
import type { Car } from "@/lib/car-types";
import { siteConfig } from "@/lib/config";
import { formatCarPrice } from "@/lib/format";

export const SITE_BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://w-automobiles.dz";

/**
 * Normalizes the WhatsApp phone number from config for wa.me links
 */
export function getCleanWhatsAppNumber(): string {
  let clean = siteConfig.contact.whatsapp.replace(/[^0-9]/g, "");
  if (clean.startsWith("0")) {
    clean = `213${clean.slice(1)}`;
  } else if (!clean.startsWith("213")) {
    clean = `213${clean}`;
  }
  return clean;
}

/**
 * Builds the localized absolute URL for a vehicle detail page.
 * French (default) stays unprefixed (/vehicules/...); en/ar use /en/... and /ar/....
 */
export function getLocalizedCarUrl(
  slug: string,
  locale: AppLocale | string = "fr"
): string {
  const base = SITE_BASE_URL.replace(/\/$/, "");
  const prefix = locale === "en" || locale === "ar" ? `/${locale}` : "";
  return `${base}${prefix}/vehicules/${slug}`;
}

export interface CarWhatsAppOptions {
  locale?: AppLocale | string;
  absolutePageUrl?: string;
  /**
   * Optional pre-formatted message built from next-intl `whatsapp.*` templates.
   * When omitted, falls back to the built-in locale template.
   */
  customMessage?: string;
}

/**
 * Builds the pre-filled WhatsApp inquiry link for a specific vehicle.
 * Supports localized templates with proper URL encoding (including Arabic).
 */
export function buildCarWhatsAppUrl(
  car: Pick<
    Car,
    "id" | "slug" | "brand" | "model" | "year" | "price" | "priceOnRequest"
  > & { status?: Car["status"] },
  optionsOrUrl?: string | CarWhatsAppOptions
): string {
  const number = getCleanWhatsAppNumber();
  const opts: CarWhatsAppOptions =
    typeof optionsOrUrl === "string"
      ? { absolutePageUrl: optionsOrUrl }
      : optionsOrUrl ?? {};

  const locale = opts.locale ?? "fr";

  if (opts.customMessage) {
    return `https://wa.me/${number}?text=${encodeURIComponent(opts.customMessage)}`;
  }

  const pageUrl = opts.absolutePageUrl || getLocalizedCarUrl(car.slug, locale);
  const priceText = formatCarPrice(car, locale);
  const ref = car.id.slice(0, 8);

  let message: string;
  if (locale === "en") {
    const question =
      car.status === "Vendu"
        ? "Do you have a similar model available?"
        : "Is it still available?";
    message = `Hello W Automobiles, I'm interested in the ${car.brand} ${car.model} ${car.year} (${priceText}, ref. ${ref}). ${question} Here is the listing: ${pageUrl}`;
  } else if (locale === "ar") {
    const question =
      car.status === "Vendu"
        ? "هل يتوفر لديكم موديل مشابه؟"
        : "هل ما زالت متوفرة؟";
    message = `مرحباً W Automobiles، أنا مهتم بسيارة ${car.brand} ${car.model} ${car.year} (${priceText}، المرجع ${ref}). ${question} رابط الإعلان: ${pageUrl}`;
  } else {
    const priceSegment =
      car.priceOnRequest || !car.price ? "(Prix sur demande)" : `à ${priceText}`;
    const statusSegment =
      car.status && car.status !== "Disponible" ? ` [${car.status}]` : "";
    const questionSegment =
      car.status === "Vendu"
        ? "Avez-vous un modèle similaire disponible ?"
        : "Est-elle toujours disponible ?";
    message = `Bonjour W Automobiles, je suis intéressé(e) par la ${car.brand} ${car.model} ${car.year} ${priceSegment}${statusSegment} (réf. ${ref}). ${questionSegment} Voici la fiche : ${pageUrl}`;
  }

  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
