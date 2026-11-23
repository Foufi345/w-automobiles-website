import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { getAllCars } from "@/lib/cars";
import { getLocalizedUrl } from "@/lib/seo";

const STATIC_ROUTES: Array<{
  pathname: string;
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;
  priority: number;
}> = [
  { pathname: "/", changeFrequency: "daily", priority: 1.0 },
  { pathname: "/vehicules", changeFrequency: "daily", priority: 0.9 },
  { pathname: "/showroom", changeFrequency: "monthly", priority: 0.8 },
  { pathname: "/contact", changeFrequency: "monthly", priority: 0.8 },
  { pathname: "/localisation", changeFrequency: "monthly", priority: 0.8 },
  { pathname: "/mentions-legales", changeFrequency: "yearly", priority: 0.3 },
];

function buildAlternates(pathname: string) {
  const frUrl = getLocalizedUrl(pathname, "fr");
  return {
    languages: {
      fr: frUrl,
      en: getLocalizedUrl(pathname, "en"),
      ar: getLocalizedUrl(pathname, "ar"),
      "x-default": frUrl,
    },
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.flatMap((route) => {
    const alternates = buildAlternates(route.pathname);
    return routing.locales.map((locale) => ({
      url: getLocalizedUrl(route.pathname, locale),
      lastModified: now,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
      alternates,
    }));
  });

  const cars = await getAllCars("fr");
  const carEntries: MetadataRoute.Sitemap = cars.flatMap((car) => {
    const pathname = `/vehicules/${car.slug}`;
    const alternates = buildAlternates(pathname);
    const lastModified = car.updatedAt ? new Date(car.updatedAt) : now;

    return routing.locales.map((locale) => ({
      url: getLocalizedUrl(pathname, locale),
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.85,
      alternates,
    }));
  });

  return [...staticEntries, ...carEntries];
}
