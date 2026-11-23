import type {
  BodyType,
  CarCondition,
  CarStatus,
  FuelType,
  TransmissionType,
} from "@/types/database";

/**
 * Maps canonical French DB enum values to `enums.*` translation keys in messages/*.json.
 * Database values always remain French and canonical.
 */
export const FUEL_LABEL_KEY: Record<FuelType, string> = {
  Essence: "fuel.essence",
  Diesel: "fuel.diesel",
  Hybride: "fuel.hybride",
  Électrique: "fuel.electrique",
  GPL: "fuel.gpl",
};

export const TRANSMISSION_LABEL_KEY: Record<TransmissionType, string> = {
  Automatique: "transmission.automatique",
  Manuelle: "transmission.manuelle",
};

export const BODY_TYPE_LABEL_KEY: Record<BodyType, string> = {
  SUV: "bodyType.suv",
  Berline: "bodyType.berline",
  Citadine: "bodyType.citadine",
  Coupé: "bodyType.coupe",
  Break: "bodyType.break",
  Utilitaire: "bodyType.utilitaire",
};

export const CONDITION_LABEL_KEY: Record<CarCondition, string> = {
  Neuf: "condition.neuf",
  Occasion: "condition.occasion",
};

export const STATUS_LABEL_KEY: Record<CarStatus, string> = {
  Disponible: "status.disponible",
  Réservé: "status.reserve",
  Vendu: "status.vendu",
};

/**
 * Language-neutral URL filter slugs <-> canonical DB values.
 * Ensures shared filter URLs work identically in FR, EN, and AR,
 * while remaining backwards-compatible with legacy French query params.
 */
export const FUEL_TO_SLUG: Record<FuelType, string> = {
  Essence: "essence",
  Diesel: "diesel",
  Hybride: "hybride",
  Électrique: "electrique",
  GPL: "gpl",
};

export const TRANSMISSION_TO_SLUG: Record<TransmissionType, string> = {
  Automatique: "automatique",
  Manuelle: "manuelle",
};

export const BODY_TYPE_TO_SLUG: Record<BodyType, string> = {
  SUV: "suv",
  Berline: "berline",
  Citadine: "citadine",
  Coupé: "coupe",
  Break: "break",
  Utilitaire: "utilitaire",
};

export const CONDITION_TO_SLUG: Record<CarCondition, string> = {
  Neuf: "neuf",
  Occasion: "occasion",
};

function normalizeToken(raw: string): string {
  return raw
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function resolveFuelFromParam(raw: string | null): FuelType | "" {
  if (!raw) return "";
  const norm = normalizeToken(raw);
  const map: Record<string, FuelType> = {
    essence: "Essence",
    petrol: "Essence",
    gasoline: "Essence",
    diesel: "Diesel",
    hybride: "Hybride",
    hybrid: "Hybride",
    electrique: "Électrique",
    electric: "Électrique",
    gpl: "GPL",
    lpg: "GPL",
  };
  return map[norm] ?? "";
}

export function resolveTransmissionFromParam(
  raw: string | null
): TransmissionType | "" {
  if (!raw) return "";
  const norm = normalizeToken(raw);
  const map: Record<string, TransmissionType> = {
    automatique: "Automatique",
    automatic: "Automatique",
    auto: "Automatique",
    manuelle: "Manuelle",
    manual: "Manuelle",
  };
  return map[norm] ?? "";
}

export function resolveBodyTypeFromParam(raw: string | null): BodyType | "" {
  if (!raw) return "";
  const norm = normalizeToken(raw);
  const map: Record<string, BodyType> = {
    suv: "SUV",
    berline: "Berline",
    sedan: "Berline",
    citadine: "Citadine",
    hatchback: "Citadine",
    coupe: "Coupé",
    break: "Break",
    wagon: "Break",
    estate: "Break",
    utilitaire: "Utilitaire",
    van: "Utilitaire",
  };
  return map[norm] ?? "";
}

export function resolveConditionFromParam(
  raw: string | null
): CarCondition | "" {
  if (!raw) return "";
  const norm = normalizeToken(raw);
  const map: Record<string, CarCondition> = {
    neuf: "Neuf",
    new: "Neuf",
    occasion: "Occasion",
    used: "Occasion",
  };
  return map[norm] ?? "";
}
