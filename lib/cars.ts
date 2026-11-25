import "server-only";
import { unstable_cache } from "next/cache";
import { createPublicSupabaseClient } from "@/lib/supabase/public";
import { cldUrl } from "@/lib/cloudinary-url";
import type { CarImage, CarRow } from "@/types/database";
import {
  formatMileage,
  formatPriceDZD,
  type BodyType,
  type Car,
  type CarCondition,
  type CarFilterOptions,
  type CarStatus,
  type FuelType,
  type TransmissionType,
} from "@/lib/car-types";

export {
  formatMileage,
  formatPriceDZD,
  type BodyType,
  type Car,
  type CarCondition,
  type CarFilterOptions,
  type CarStatus,
  type FuelType,
  type TransmissionType,
};

function parseImages(raw: unknown): CarImage[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is CarImage =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as CarImage).public_id === "string" &&
      typeof (item as CarImage).url === "string"
  );
}

function normalizeStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is string => typeof item === "string")
    .map((s) => s.trim())
    .filter(Boolean);
}

function resolveLocalizedDescription(row: CarRow, locale: string): string {
  const fr = row.description?.trim() ?? "";
  if (locale === "en") {
    const en = row.description_en?.trim();
    return en ? en : fr;
  }
  if (locale === "ar") {
    const ar = row.description_ar?.trim();
    return ar ? ar : fr;
  }
  return fr;
}

function resolveLocalizedFeatures(row: CarRow, locale: string): string[] {
  const fr = normalizeStringArray(row.features);
  if (locale === "en") {
    const en = normalizeStringArray(row.features_en);
    return en.length > 0 ? en : fr;
  }
  if (locale === "ar") {
    const ar = normalizeStringArray(row.features_ar);
    return ar.length > 0 ? ar : fr;
  }
  return fr;
}

/**
 * Maps a Supabase snake_case `cars` row to the UI `Car` shape for the given locale.
 * Falls back to French field-by-field when an EN or AR translation is missing/empty.
 */
export function mapCarRowToCar(row: CarRow, locale: string = "fr"): Car {
  const imageRecords = parseImages(row.images);
  const images = imageRecords.map((img) =>
    img.public_id ? cldUrl(img.public_id, { width: 1200 }) : img.url
  );

  return {
    id: row.id,
    slug: row.slug,
    brand: row.brand,
    model: row.model,
    year: row.year,
    price: row.price ?? 0,
    priceOnRequest: row.price_on_request,
    mileage: row.mileage,
    fuel: row.fuel,
    transmission: row.transmission,
    bodyType: row.body_type,
    color: row.color ?? "",
    power: row.power ?? "",
    engine: row.engine ?? "",
    doors: row.doors ?? 4,
    seats: row.seats ?? 5,
    condition: row.condition,
    status: row.status,
    featured: row.featured,
    published: row.published,
    description: resolveLocalizedDescription(row, locale),
    features: resolveLocalizedFeatures(row, locale),
    images,
    imageRecords,
    updatedAt: row.updated_at,
  };
}

/**
 * Shared raw cache across all locales (same underlying DB rows, tagged "cars").
 */
const getAllCarRowsCached = unstable_cache(
  async (): Promise<CarRow[]> => {
    try {
      const supabase = createPublicSupabaseClient();
      const { data, error } = await supabase
        .from("cars")
        .select("*")
        .eq("published", true)
        .order("created_at", { ascending: false })
        .order("year", { ascending: false });

      if (error) {
        console.warn(`Failed to fetch published cars: ${error.message}`);
        return [];
      }

      return data ?? [];
    } catch (err) {
      console.warn("Failed to fetch published cars:", err);
      return [];
    }
  },
  ["cars:all"],
  {
    tags: ["cars"],
    revalidate: 3600,
  }
);

/**
 * Returns all published vehicles from Supabase, sorted newest first,
 * with localized description and features.
 */
export async function getAllCars(locale: string = "fr"): Promise<Car[]> {
  const rows = await getAllCarRowsCached();
  return rows.map((row) => mapCarRowToCar(row, locale));
}

/**
 * Finds a single published vehicle by its URL slug.
 * Returns undefined if not found or if published = false (so detail pages return 404).
 */
export async function getCarBySlug(
  slug: string,
  locale: string = "fr"
): Promise<Car | undefined> {
  const fetchBySlug = unstable_cache(
    async (): Promise<CarRow | null> => {
      try {
        const supabase = createPublicSupabaseClient();
        const { data, error } = await supabase
          .from("cars")
          .select("*")
          .eq("slug", slug)
          .eq("published", true)
          .maybeSingle();

        if (error) {
          console.warn(`Failed to fetch car "${slug}": ${error.message}`);
          return null;
        }

        return data ?? null;
      } catch (err) {
        console.warn(`Failed to fetch car "${slug}":`, err);
        return null;
      }
    },
    ["car:by-slug", slug],
    {
      tags: ["cars", `car:${slug}`],
      revalidate: 3600,
    }
  );

  const row = await fetchBySlug();
  return row ? mapCarRowToCar(row, locale) : undefined;
}

/**
 * Shared raw cache for featured vehicles across all locales (tagged "cars").
 */
const getFeaturedCarRowsCached = unstable_cache(
  async (): Promise<CarRow[]> => {
    try {
      const supabase = createPublicSupabaseClient();
      const { data, error } = await supabase
        .from("cars")
        .select("*")
        .eq("published", true)
        .order("featured", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) {
        console.warn(`Failed to fetch featured cars: ${error.message}`);
        return [];
      }

      return data ?? [];
    } catch (err) {
      console.warn("Failed to fetch featured cars:", err);
      return [];
    }
  },
  ["cars:featured"],
  {
    tags: ["cars"],
    revalidate: 3600,
  }
);

export async function getFeaturedCars(
  limit?: number,
  locale: string = "fr"
): Promise<Car[]> {
  const rows = await getFeaturedCarRowsCached();
  const cars = rows.map((row) => mapCarRowToCar(row, locale));
  const featuredOnly = cars.filter((car) => car.featured);
  const list = featuredOnly.length > 0 ? featuredOnly : cars;
  return typeof limit === "number" ? list.slice(0, limit) : list;
}

/**
 * Extracts distinct filter facet options and price bounds from published vehicles.
 */
export async function getFilterOptions(): Promise<CarFilterOptions> {
  const cars = await getAllCars("fr");

  const brands = Array.from(new Set(cars.map((c) => c.brand))).sort();
  const fuels = Array.from(new Set(cars.map((c) => c.fuel)));
  const transmissions = Array.from(new Set(cars.map((c) => c.transmission)));
  const bodyTypes = Array.from(new Set(cars.map((c) => c.bodyType)));
  const conditions = Array.from(new Set(cars.map((c) => c.condition)));
  const years = Array.from(new Set(cars.map((c) => c.year))).sort(
    (a, b) => b - a
  );

  const numericPrices = cars
    .filter((c) => !c.priceOnRequest && c.price > 0)
    .map((c) => c.price);

  const minPrice = numericPrices.length > 0 ? Math.min(...numericPrices) : 0;
  const maxPrice = numericPrices.length > 0 ? Math.max(...numericPrices) : 0;

  return {
    brands,
    fuels,
    transmissions,
    bodyTypes,
    conditions,
    years,
    priceRange: {
      min: minPrice,
      max: maxPrice,
    },
  };
}

/**
 * Returns up to `limit` similar published vehicles prioritizing same brand or bodyType.
 */
export async function getSimilarCars(
  currentCar: Car,
  limit = 3,
  locale: string = "fr"
): Promise<Car[]> {
  const allCars = await getAllCars(locale);
  const others = allCars.filter((c) => c.id !== currentCar.id);

  const scored = others.map((candidate) => {
    let score = 0;
    if (candidate.brand === currentCar.brand) score += 3;
    if (candidate.bodyType === currentCar.bodyType) score += 2;
    return { candidate, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((item) => item.candidate);
}
