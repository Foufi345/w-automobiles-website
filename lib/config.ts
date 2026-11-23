import type { AppLocale } from "@/i18n/routing";

export interface NavItem {
  key: "home" | "vehicles" | "showroom" | "contact";
  label: string;
  href: string;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { key: "home", label: "Accueil", href: "/" },
  { key: "vehicles", label: "Nos véhicules", href: "/vehicules" },
  { key: "showroom", label: "Le showroom", href: "/showroom" },
  { key: "contact", label: "Contact", href: "/contact" },
] as const;

export type WeekdayKey =
  | "saturday"
  | "sunday"
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday";

export interface StructuredDayHours {
  dayIndex: number; // 0 = Sunday ... 6 = Saturday
  key: WeekdayKey;
  open: string | null; // "09:00"
  close: string | null; // "18:00"
  isOpenDay: boolean;
}

/**
 * Structured weekly opening hours (Saturday–Friday, Algerian business week, Africa/Algiers).
 * Rendered per locale in OpeningHoursStatus and localized config helpers.
 */
export const WEEKLY_OPENING_HOURS: readonly StructuredDayHours[] = [
  { dayIndex: 6, key: "saturday", open: "09:00", close: "18:00", isOpenDay: true },
  { dayIndex: 0, key: "sunday", open: "09:00", close: "18:00", isOpenDay: true },
  { dayIndex: 1, key: "monday", open: "09:00", close: "18:00", isOpenDay: true },
  { dayIndex: 2, key: "tuesday", open: "09:00", close: "18:00", isOpenDay: true },
  { dayIndex: 3, key: "wednesday", open: "09:00", close: "18:00", isOpenDay: true },
  { dayIndex: 4, key: "thursday", open: "09:00", close: "18:00", isOpenDay: true },
  { dayIndex: 5, key: "friday", open: null, close: null, isOpenDay: false },
] as const;

export interface BusinessConfig {
  name: string;
  tagline: string;
  activity: string;
  address: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
    full: string;
    googleMapsUrl: string;
    googleMapsEmbedUrl: string;
  };
  contact: {
    whatsapp: string;
    phone: string;
    email: string;
  };
  hours: {
    schedule: string;
    closed: string;
    full: string;
  };
  socials: {
    instagramHandle: string;
    instagramUrl: string;
  };
  brands: readonly string[];
}

const SHARED_CORE = {
  name: "W AUTOMOBILES",
  postalCode: "16000",
  googleMapsUrl:
    "https://www.google.com/maps/search/?api=1&query=218+Route+de+la+gare+routiere+Cheraga+Alger+16000",
  googleMapsEmbedUrl:
    "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3196.0720779448993!2d2.9484615467357376!3d36.76883829816651!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x128fb1dd5cf45e3d%3A0x39b24ba7c54ec157!2sW%20automobile!5e0!3m2!1sen!2sdz!4v1795213066147!5m2!1sen!2sdz",
  contact: {
    whatsapp: "+213 556 12 57 34",
    phone: "0556 12 57 34",
    email: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "",
  },
  socials: {
    instagramHandle: "@w_automobiles_algerie",
    instagramUrl: "https://www.instagram.com/w_automobiles_algerie/",
  },
  brands: [
    "Volkswagen",
    "Mercedes-Benz",
    "Livan",
    "Opel",
    "Geely",
    "Porsche",
    "MG",
    "Audi",
  ] as const,
};

const LOCALIZED_BUSINESS_COPY: Record<
  AppLocale,
  {
    tagline: string;
    activity: string;
    street: string;
    city: string;
    country: string;
    fullAddress: string;
    schedule: string;
    closed: string;
    fullHours: string;
  }
> = {
  fr: {
    tagline: "Concessionnaire automobile multimarques",
    activity: "Vente, achat et reprise d'une large gamme de véhicules",
    street: "218 Route de la gare routière, Cheraga",
    city: "Alger",
    country: "Algérie",
    fullAddress: "218 Route de la gare routière, Cheraga, Alger 16000",
    schedule: "Samedi à Jeudi : 09:00 – 18:00",
    closed: "Vendredi : Fermé",
    fullHours: "Samedi à Jeudi 09:00 – 18:00, Vendredi fermé",
  },
  en: {
    tagline: "Multi-brand car dealership",
    activity: "Sales, cash purchase, and trade-in of a curated range of vehicles",
    street: "218 Route de la gare routière, Cheraga",
    city: "Algiers",
    country: "Algeria",
    fullAddress: "218 Route de la gare routière, Cheraga, Algiers 16000",
    schedule: "Saturday to Thursday: 09:00 – 18:00",
    closed: "Friday: Closed",
    fullHours: "Saturday to Thursday 09:00 – 18:00, Closed Friday",
  },
  ar: {
    tagline: "وكيل سيارات متعدد العلامات",
    activity: "بيع، شراء نقدي واستبدال تشكيلة واسعة من السيارات",
    street: "218 طريق المحطة البرية، الشراقة",
    city: "الجزائر العاصمة",
    country: "الجزائر",
    fullAddress: "218 طريق المحطة البرية، الشراقة، الجزائر العاصمة 16000",
    schedule: "السبت إلى الخميس: 09:00 – 18:00",
    closed: "الجمعة: مغلق",
    fullHours: "السبت إلى الخميس 09:00 – 18:00، الجمعة مغلق",
  },
};

export function getLocalizedSiteConfig(locale: AppLocale | string = "fr"): BusinessConfig {
  const loc: AppLocale =
    locale === "en" || locale === "ar" ? locale : "fr";
  const copy = LOCALIZED_BUSINESS_COPY[loc];
  return {
    name: SHARED_CORE.name,
    tagline: copy.tagline,
    activity: copy.activity,
    address: {
      street: copy.street,
      city: copy.city,
      postalCode: SHARED_CORE.postalCode,
      country: copy.country,
      full: copy.fullAddress,
      googleMapsUrl: SHARED_CORE.googleMapsUrl,
      googleMapsEmbedUrl: SHARED_CORE.googleMapsEmbedUrl,
    },
    contact: SHARED_CORE.contact,
    hours: {
      schedule: copy.schedule,
      closed: copy.closed,
      full: copy.fullHours,
    },
    socials: SHARED_CORE.socials,
    brands: SHARED_CORE.brands,
  };
}

// Default French config export for backwards compatibility
export const siteConfig: BusinessConfig = getLocalizedSiteConfig("fr");

/**
 * Helper to build a pre-filled WhatsApp chat URL
 */
export function getWhatsAppUrl(message?: string): string {
  let cleanNumber = SHARED_CORE.contact.whatsapp.replace(/[^0-9]/g, "");
  if (cleanNumber.startsWith("0")) {
    cleanNumber = `213${cleanNumber.slice(1)}`;
  } else if (!cleanNumber.startsWith("213")) {
    cleanNumber = `213${cleanNumber}`;
  }
  const base = `https://wa.me/${cleanNumber}`;
  if (!message) return base;
  return `${base}?text=${encodeURIComponent(message)}`;
}
