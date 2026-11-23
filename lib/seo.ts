import type { Metadata } from "next";
import { routing, type AppLocale } from "@/i18n/routing";
import { SITE_BASE_URL } from "@/lib/whatsapp";
import type { BodyType, FuelType, TransmissionType } from "@/types/database";

const BASE_URL = SITE_BASE_URL.replace(/\/$/, "");

export const OG_LOCALE_MAP: Record<AppLocale, string> = {
  fr: "fr_FR",
  en: "en_US",
  ar: "ar_AR",
};

export const SCHEMA_FUEL_TYPE: Record<FuelType, string> = {
  Essence: "Gasoline",
  Diesel: "Diesel",
  Hybride: "Hybrid",
  Électrique: "Electric",
  GPL: "LPG",
};

export const SCHEMA_TRANSMISSION: Record<TransmissionType, string> = {
  Automatique: "Automatic",
  Manuelle: "Manual",
};

export const SCHEMA_BODY_TYPE: Record<BodyType, string> = {
  Berline: "Sedan",
  SUV: "SUV",
  Citadine: "Hatchback",
  Break: "Station Wagon",
  Coupé: "Coupe",
  Utilitaire: "Utility",
};

/**
 * Returns the localized path for a canonical pathname (e.g. "/", "/vehicules", "/vehicules/slug").
 * French (default) has no prefix; English uses /en; Arabic uses /ar.
 */
export function getLocalizedPath(pathname: string, locale: AppLocale): string {
  const normalized = pathname === "/" ? "" : pathname.replace(/\/+$/, "");
  if (locale === routing.defaultLocale) {
    return normalized || "/";
  }
  return `/${locale}${normalized}`;
}

/**
 * Returns the absolute localized URL for a canonical pathname.
 */
export function getLocalizedUrl(pathname: string, locale: AppLocale): string {
  const path = getLocalizedPath(pathname, locale);
  return path === "/" ? `${BASE_URL}/` : `${BASE_URL}${path}`;
}

/**
 * Returns self-referencing canonical and reciprocal hreflang alternates
 * (fr, en, ar, and x-default pointing to the French URL).
 */
export function buildLocalizedAlternates(
  pathname: string,
  locale: AppLocale
): NonNullable<Metadata["alternates"]> {
  const frUrl = getLocalizedUrl(pathname, "fr");
  const enUrl = getLocalizedUrl(pathname, "en");
  const arUrl = getLocalizedUrl(pathname, "ar");

  return {
    canonical: getLocalizedUrl(pathname, locale),
    languages: {
      fr: frUrl,
      en: enUrl,
      ar: arUrl,
      "x-default": frUrl,
    },
  };
}

/**
 * Returns the OG alternate locales (the two other languages).
 */
export function getAlternateOgLocales(locale: AppLocale): string[] {
  return routing.locales
    .filter((l) => l !== locale)
    .map((l) => OG_LOCALE_MAP[l]);
}

/**
 * Builds consistent Open Graph metadata with og:locale + og:locale:alternate.
 */
export function buildLocalizedOpenGraph(options: {
  locale: AppLocale;
  pathname: string;
  siteName: string;
  title: string;
  description: string;
  type?: "website" | "article";
  images?: NonNullable<NonNullable<Metadata["openGraph"]>["images"]>;
}): NonNullable<Metadata["openGraph"]> {
  return {
    type: options.type ?? "website",
    locale: OG_LOCALE_MAP[options.locale],
    alternateLocale: getAlternateOgLocales(options.locale),
    url: getLocalizedUrl(options.pathname, options.locale),
    siteName: options.siteName,
    title: options.title,
    description: options.description,
    images: options.images ?? [
      {
        url: "/images/showroom-hero.jpg",
        width: 1920,
        height: 1080,
        alt: options.title,
      },
    ],
  };
}

/**
 * Builds consistent Twitter card metadata.
 */
export function buildLocalizedTwitter(options: {
  title: string;
  description: string;
  images?: string[];
}): NonNullable<Metadata["twitter"]> {
  return {
    card: "summary_large_image",
    title: options.title,
    description: options.description,
    images: options.images ?? ["/images/showroom-hero.jpg"],
  };
}
