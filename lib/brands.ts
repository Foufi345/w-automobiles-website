import type { Car } from "@/lib/car-types";
import { translateColor } from "@/lib/colors";

/**
 * Normalizes Latin and Arabic search text:
 * - Strips Latin accents/diacritics
 * - Strips Arabic tashkeel (diacritics) and tatweel
 * - Normalizes Arabic letter variants (أ/إ/آ/ٱ -> ا, ة -> ه, ى -> ي, ؤ -> و, ئ -> ي)
 * - Lowercases and collapses whitespace
 */
export function normalizeSearchText(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .toLowerCase()
    .replace(/[-_/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Canonical brand names mapped to their Arabic and Latin search aliases.
 */
export const BRAND_ALIASES: Record<string, string[]> = {
  Audi: ["audi", "أودي", "اودي"],
  Volkswagen: [
    "volkswagen",
    "vw",
    "فولكسفاغن",
    "فولكس فاجن",
    "فولكس فاغن",
    "فولكسواغن",
    "فولكسفاكن",
  ],
  "Mercedes-Benz": [
    "mercedes-benz",
    "mercedes",
    "benz",
    "مرسيدس",
    "مرسيدس بنز",
    "مورسيدس",
    "مارسيدس",
  ],
  Opel: ["opel", "أوبل", "اوبل"],
  Geely: ["geely", "جيلي"],
  MG: ["mg", "إم جي", "ام جي", "امجي"],
  Porsche: ["porsche", "بورش", "بورشه"],
  Livan: ["livan", "ليفان"],
  Cupra: ["cupra", "كوبرا"],
  BMW: ["bmw", "بي ام دبليو", "بي إم دبليو", "بي ام"],
  Peugeot: ["peugeot", "بيجو"],
  Renault: ["renault", "رينو", "رونو"],
  Hyundai: ["hyundai", "هيونداي"],
  Kia: ["kia", "كيا"],
  Toyota: ["toyota", "تويوتا"],
  Seat: ["seat", "سيات"],
  Skoda: ["skoda", "سكودا"],
  Fiat: ["fiat", "فيات"],
  Chery: ["chery", "شيري"],
};

const MODEL_ALIASES: Record<string, string[]> = {
  golf: ["غولف", "جولف", "قلف"],
  tiguan: ["تيغوان", "تيجوان"],
  macan: ["ماكان"],
  coolray: ["كولراي", "كول راي"],
  mokka: ["موكا"],
  formentor: ["فورمنتور"],
  classe: ["كلاس", "الفئة", "فئة"],
  sportback: ["سبورتباك", "سبورت باك"],
};

const NORMALIZED_BRAND_ALIASES: Array<{ canonical: string; aliases: string[] }> =
  Object.entries(BRAND_ALIASES).map(([canonical, aliases]) => ({
    canonical: normalizeSearchText(canonical),
    aliases: aliases.map(normalizeSearchText),
  }));

const NORMALIZED_MODEL_ALIASES: Array<{ token: string; aliases: string[] }> =
  Object.entries(MODEL_ALIASES).map(([token, aliases]) => ({
    token: normalizeSearchText(token),
    aliases: aliases.map(normalizeSearchText),
  }));

/**
 * Resolves an Arabic or Latin brand alias to its canonical brand name when possible.
 */
export function resolveBrandAlias(query: string): string | null {
  const normalized = normalizeSearchText(query);
  if (!normalized) return null;

  for (const [canonical, aliases] of Object.entries(BRAND_ALIASES)) {
    if (
      normalizeSearchText(canonical) === normalized ||
      aliases.some((alias) => normalizeSearchText(alias) === normalized)
    ) {
      return canonical;
    }
  }
  return null;
}

/**
 * Builds a cross-language normalized haystack for a vehicle so visitors can search
 * in French, English, or Arabic (e.g. "مرسيدس" finds "Mercedes-Benz").
 */
function buildVehicleHaystack(car: Car): string {
  const parts: string[] = [
    car.brand,
    car.model,
    car.engine,
    car.bodyType,
    car.fuel,
    car.color,
    translateColor(car.color, "en"),
    translateColor(car.color, "ar"),
    String(car.year),
  ];

  const normalizedBrand = normalizeSearchText(car.brand);
  for (const entry of NORMALIZED_BRAND_ALIASES) {
    if (
      entry.canonical === normalizedBrand ||
      entry.aliases.includes(normalizedBrand)
    ) {
      parts.push(...entry.aliases);
    }
  }

  const normalizedModel = normalizeSearchText(car.model);
  for (const entry of NORMALIZED_MODEL_ALIASES) {
    if (normalizedModel.includes(entry.token)) {
      parts.push(...entry.aliases);
    }
  }

  return normalizeSearchText(parts.join(" "));
}

/**
 * Matches a vehicle against a free-text query across French, English, and Arabic.
 */
export function matchesVehicleSearch(car: Car, rawQuery: string): boolean {
  const normalizedQuery = normalizeSearchText(rawQuery);
  if (!normalizedQuery) return true;

  const haystack = buildVehicleHaystack(car);
  const tokens = normalizedQuery.split(" ").filter(Boolean);
  return tokens.every((token) => haystack.includes(token));
}
