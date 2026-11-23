import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { CarInsert, Database } from "../types/database.ts";

interface LegacyJsonCar {
  id: string;
  slug: string;
  brand: string;
  model: string;
  year: number;
  price: number | null;
  priceOnRequest: boolean;
  mileage: number;
  fuel: CarInsert["fuel"];
  transmission: CarInsert["transmission"];
  bodyType: CarInsert["body_type"];
  color?: string;
  power?: string;
  engine?: string;
  doors?: number;
  seats?: number;
  condition: CarInsert["condition"];
  featured?: boolean;
  description?: string;
  description_en?: string;
  description_ar?: string;
  features?: string[];
  features_en?: string[];
  features_ar?: string[];
  images?: string[];
}

function getRequiredEnv(name: string, fallbackName?: string): string {
  const val =
    process.env[name]?.trim() ||
    (fallbackName ? process.env[fallbackName]?.trim() : "");
  if (!val) {
    const names = fallbackName ? `${name} (or ${fallbackName})` : name;
    throw new Error(`Missing required environment variable: ${names}`);
  }
  return val;
}

async function main() {
  const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL");
  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const jsonPath = resolve(process.cwd(), "data/cars.json");
  const raw = readFileSync(jsonPath, "utf8");
  const legacyCars = JSON.parse(raw) as LegacyJsonCar[];

  const rows: CarInsert[] = legacyCars.map((car) => ({
    slug: car.slug,
    brand: car.brand,
    model: car.model,
    year: car.year,
    price: car.price ?? null,
    price_on_request: Boolean(car.priceOnRequest),
    mileage: car.mileage ?? 0,
    fuel: car.fuel,
    transmission: car.transmission,
    body_type: car.bodyType,
    color: car.color ?? null,
    power: car.power ?? null,
    engine: car.engine ?? null,
    doors: car.doors ?? null,
    seats: car.seats ?? null,
    condition: car.condition,
    status: "Disponible",
    featured: Boolean(car.featured),
    published: true,
    description: car.description ?? null,
    // Draft EN/AR translations from data/cars.json — needs native review
    description_en: car.description_en ?? null,
    description_ar: car.description_ar ?? null,
    features: Array.isArray(car.features) ? car.features : [],
    features_en: Array.isArray(car.features_en) ? car.features_en : [],
    features_ar: Array.isArray(car.features_ar) ? car.features_ar : [],
    // Real photos will be uploaded through the admin dashboard
    images: [],
  }));

  const { data, error } = await supabase
    .from("cars")
    .upsert(rows, { onConflict: "slug" })
    .select("id, slug, brand, model");

  if (error) {
    console.error("Failed to seed cars:", error.message);
    process.exit(1);
  }

  console.log(`Seeded ${data?.length ?? rows.length} vehicles (idempotent upsert on slug):`);
  for (const item of data ?? []) {
    console.log(`  - ${item.slug} (${item.brand} ${item.model})`);
  }
}

main().catch((err) => {
  console.error("Seed error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
