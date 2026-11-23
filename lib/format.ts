import type { AppLocale } from "@/i18n/routing";
import type { Car } from "@/lib/car-types";

/**
 * Always use Latin digits in Arabic (ar-DZ-u-nu-latn) and Gregorian calendar in Africa/Algiers.
 */
function getIntlLocale(locale: string): string {
  switch (locale) {
    case "ar":
      return "ar-DZ-u-nu-latn";
    case "en":
      return "en-US";
    case "fr":
    default:
      return "fr-DZ";
  }
}

export function formatNumber(value: number, locale: AppLocale | string = "fr"): string {
  if (locale === "ar") {
    // Space-grouped Latin digits (e.g. "7 500 000")
    return new Intl.NumberFormat("fr-FR").format(value).replace(/\u202f|\u00a0/g, " ");
  }
  if (locale === "en") {
    return new Intl.NumberFormat("en-US").format(value);
  }
  return new Intl.NumberFormat("fr-DZ").format(value).replace(/\u202f|\u00a0/g, " ");
}

/**
 * Price patterns:
 * - fr: "7 500 000 DA"
 * - en: "7,500,000 DA"
 * - ar: "7 500 000 دج"
 */
export function formatCurrencyDZD(
  amount: number,
  locale: AppLocale | string = "fr"
): string {
  const num = formatNumber(amount, locale);
  // Isolate space-grouped Latin digits with LRI/PDI so RTL never reverses "15 500 000" -> "000 500 15"
  if (locale === "ar") return `\u2066${num}\u2069 دج`;
  return `${num} DA`;
}

export function formatCarPrice(
  car: Pick<Car, "price" | "priceOnRequest">,
  locale: AppLocale | string = "fr",
  priceOnRequestLabel?: string
): string {
  if (car.priceOnRequest || !car.price) {
    if (priceOnRequestLabel) return priceOnRequestLabel;
    if (locale === "en") return "Price on request";
    if (locale === "ar") return "السعر عند الطلب";
    return "Prix sur demande";
  }
  return formatCurrencyDZD(car.price, locale);
}

/**
 * Mileage formatting:
 * - fr/en: "45 000 km" / "45,000 km"
 * - ar: "45 000 كم"
 */
export function formatMileageLocalized(
  mileage: number,
  locale: AppLocale | string = "fr",
  options?: { zeroNewLabel?: string; compact?: boolean }
): string {
  const unit = locale === "ar" ? "كم" : "km";
  if (mileage === 0) {
    if (options?.compact) return `0 ${unit}`;
    if (options?.zeroNewLabel) return options.zeroNewLabel;
    if (locale === "en") return "0 km (New)";
    if (locale === "ar") return "0 كم (جديدة)";
    return "0 km (Neuf)";
  }
  const num = formatNumber(mileage, locale);
  if (locale === "ar") return `\u2066${num}\u2069 ${unit}`;
  return `${num} ${unit}`;
}

/**
 * Power unit conversion at display time:
 * Stored DB value is e.g. "204 ch" -> fr: "204 ch", en: "204 hp", ar: "204 حصان"
 */
export function formatPowerLocalized(
  power: string,
  locale: AppLocale | string = "fr"
): string {
  const trimmed = power.trim();
  if (!trimmed) return "";
  const unit = locale === "en" ? "hp" : locale === "ar" ? "حصان" : "ch";
  if (/\b(ch|cv|hp)\b/i.test(trimmed)) {
    return trimmed.replace(/\b(ch|cv|hp)\b/gi, unit);
  }
  if (/^\d+$/.test(trimmed)) {
    return `${trimmed} ${unit}`;
  }
  return trimmed;
}

/**
 * Date formatting in Africa/Algiers timezone, Gregorian calendar, Latin digits in Arabic.
 */
export function formatDateLocalized(
  iso: string | Date,
  locale: AppLocale | string = "fr",
  options: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }
): string {
  try {
    const date = typeof iso === "string" ? new Date(iso) : iso;
    return new Intl.DateTimeFormat(getIntlLocale(locale), {
      timeZone: "Africa/Algiers",
      calendar: "gregory",
      ...options,
    }).format(date);
  } catch {
    return "—";
  }
}
