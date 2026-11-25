import { Amiri, Cairo, Cormorant_Garamond, Inter } from "next/font/google";

export const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

export const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
});

// preload: false ensures French/English visitors never preload or download Arabic font files;
// the browser only fetches Amiri & Cairo when Arabic glyphs render under locale === "ar".
export const amiri = Amiri({
  subsets: ["arabic"],
  weight: ["400", "700"],
  style: ["normal"],
  variable: "--font-arabic-heading",
  display: "swap",
  preload: false,
});

export const cairo = Cairo({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-arabic-body",
  display: "swap",
  preload: false,
});
