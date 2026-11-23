export type ColorLocale = "fr" | "en" | "ar";

export interface ColorPreset {
  fr: string;
  en: string;
  ar: string;
  aliases?: string[];
}

/**
 * Preset automotive colors with French, English and Arabic display labels.
 * Unknown free-text colors entered in /admin are displayed as typed.
 */
export const COLOR_PRESETS: ColorPreset[] = [
  // Base colors
  { fr: "Noir", en: "Black", ar: "أسود", aliases: ["noir metallise", "black"] },
  { fr: "Blanc", en: "White", ar: "أبيض", aliases: ["white"] },
  { fr: "Gris", en: "Grey", ar: "رمادي", aliases: ["grey", "gray"] },
  { fr: "Argent", en: "Silver", ar: "فضي", aliases: ["gris argent", "silver"] },
  { fr: "Rouge", en: "Red", ar: "أحمر", aliases: ["red"] },
  { fr: "Bleu", en: "Blue", ar: "أزرق", aliases: ["blue"] },
  { fr: "Vert", en: "Green", ar: "أخضر", aliases: ["green"] },
  { fr: "Beige", en: "Beige", ar: "بيج" },
  { fr: "Marron", en: "Brown", ar: "بني", aliases: ["brown"] },
  { fr: "Orange", en: "Orange", ar: "برتقالي" },
  { fr: "Jaune", en: "Yellow", ar: "أصفر", aliases: ["yellow"] },
  { fr: "Bordeaux", en: "Burgundy", ar: "عنابي", aliases: ["burgundy"] },
  { fr: "Champagne", en: "Champagne", ar: "شامبانيا" },
  { fr: "Bronze", en: "Bronze", ar: "برونزي" },
  { fr: "Bleu Nuit", en: "Midnight Blue", ar: "أزرق داكن" },
  { fr: "Gris Anthracite", en: "Anthracite Grey", ar: "رمادي فحمي" },
  { fr: "Gris Nardo", en: "Nardo Grey", ar: "رمادي ناردو" },

  // Showroom metallic / matte finishes
  {
    fr: "Noir Mythos Métallisé",
    en: "Mythos Black Metallic",
    ar: "أسود ميثوس معدني",
    aliases: ["noir mythic metallise", "noir mythos"],
  },
  {
    fr: "Noir Ébène Nacré",
    en: "Deep Black Pearl",
    ar: "أسود لؤلؤي",
  },
  {
    fr: "Blanc Polaire",
    en: "Polar White",
    ar: "أبيض قطبي",
  },
  {
    fr: "Blanc Pur",
    en: "Pure White",
    ar: "أبيض نقي",
  },
  {
    fr: "Blanc Nacré",
    en: "Pearl White",
    ar: "أبيض لؤلؤي",
  },
  {
    fr: "Blanc Jade / Toit Noir Karbon",
    en: "Jade White / Karbon Black Roof",
    ar: "أبيض يشمي بسقف أسود كاربون",
  },
  {
    fr: "Gris Dauphin Métallisé",
    en: "Dolphin Grey Metallic",
    ar: "رمادي دولفين معدني",
  },
  {
    fr: "Gris Chronos Métallisé",
    en: "Chronos Grey Metallic",
    ar: "رمادي كرونوس معدني",
  },
  {
    fr: "Gris Magnétique Mat",
    en: "Magnetic Tech Matte",
    ar: "رمادي مغناطيسي مطفي",
  },
  {
    fr: "Gris Lavande Mat",
    en: "Matte Lavender Grey",
    ar: "رمادي لافندر مطفي",
  },
  {
    fr: "Gris Craie",
    en: "Chalk Grey",
    ar: "رمادي طباشيري",
    aliases: ["craie", "craie (chalk)", "chalk"],
  },
  {
    fr: "Rouge Diamant",
    en: "Diamond Red",
    ar: "أحمر ماسي",
  },
  {
    fr: "Bleu Azur Métallisé",
    en: "Azure Blue Metallic",
    ar: "أزرق سماوي معدني",
  },
];

function normalizeColorKey(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const COLOR_LOOKUP = new Map<string, ColorPreset>();
for (const preset of COLOR_PRESETS) {
  COLOR_LOOKUP.set(normalizeColorKey(preset.fr), preset);
  COLOR_LOOKUP.set(normalizeColorKey(preset.en), preset);
  COLOR_LOOKUP.set(normalizeColorKey(preset.ar), preset);
  for (const alias of preset.aliases ?? []) {
    COLOR_LOOKUP.set(normalizeColorKey(alias), preset);
  }
}

/**
 * Translates a canonical French (or preset) color string to the requested locale.
 * Unknown free-text colors are returned as typed.
 */
export function translateColor(
  rawColor: string | null | undefined,
  locale: string
): string {
  const trimmed = rawColor?.trim() ?? "";
  if (!trimmed) return "";

  const matched = COLOR_LOOKUP.get(normalizeColorKey(trimmed));
  if (!matched) return trimmed;

  if (locale === "ar") return matched.ar;
  if (locale === "en") return matched.en;
  return matched.fr;
}
