import type {
  BodyType,
  CarCondition,
  CarImage,
  CarStatus,
  FuelType,
  TransmissionType,
} from "@/types/database";

export type {
  BodyType,
  CarCondition,
  CarImage,
  CarStatus,
  FuelType,
  TransmissionType,
};

export interface Car {
  id: string;
  slug: string;
  brand: string;
  model: string;
  year: number;
  price: number;
  priceOnRequest: boolean;
  mileage: number;
  fuel: FuelType;
  transmission: TransmissionType;
  bodyType: BodyType;
  color: string;
  power: string;
  engine: string;
  doors: number;
  seats: number;
  condition: CarCondition;
  status: CarStatus;
  featured: boolean;
  published: boolean;
  description: string;
  features: string[];
  /**
   * Ordered image URLs (Cloudinary f_auto,q_auto URLs or local placeholder fallback).
   * First item is the cover photo.
   */
  images: string[];
  /**
   * Raw Cloudinary metadata when available (public_id, url, width, height).
   */
  imageRecords?: CarImage[];
  /**
   * ISO timestamp of the last update in Supabase (used for sitemap lastModified).
   */
  updatedAt?: string;
}

export interface CarFilterOptions {
  brands: string[];
  fuels: FuelType[];
  transmissions: TransmissionType[];
  bodyTypes: BodyType[];
  conditions: CarCondition[];
  years: number[];
  priceRange: {
    min: number;
    max: number;
  };
}

/**
 * Formats a price in DZD (Algerian Dinar) or returns "Prix sur demande"
 */
export function formatPriceDZD(
  car: Pick<Car, "price" | "priceOnRequest">
): string {
  if (car.priceOnRequest || !car.price) {
    return "Prix sur demande";
  }
  return `${new Intl.NumberFormat("fr-DZ").format(car.price)} DA`;
}

/**
 * Formats mileage in kilometers
 */
export function formatMileage(mileage: number): string {
  if (mileage === 0) {
    return "0 km (Neuf)";
  }
  return `${new Intl.NumberFormat("fr-DZ").format(mileage)} km`;
}
