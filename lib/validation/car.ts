import { z } from "zod";

export const FUEL_VALUES = [
  "Essence",
  "Diesel",
  "Hybride",
  "Électrique",
  "GPL",
] as const;

export const TRANSMISSION_VALUES = ["Manuelle", "Automatique"] as const;

export const BODY_TYPE_VALUES = [
  "Berline",
  "SUV",
  "Citadine",
  "Break",
  "Coupé",
  "Utilitaire",
] as const;

export const CONDITION_VALUES = ["Neuf", "Occasion"] as const;

export const STATUS_VALUES = ["Disponible", "Réservé", "Vendu"] as const;

export const MAX_MODEL_YEAR = new Date().getFullYear() + 1;

/**
 * Zod schemas return translation KEYS (under the `admin` namespace) rather than
 * hardcoded language strings. The UI resolves them with `t(key, params)`.
 */
export const carImageSchema = z.object({
  public_id: z.string().trim().min(1, "validation.imagePublicIdRequired"),
  url: z.string().url("validation.imageUrlInvalid"),
  width: z.number().int().positive("validation.imageWidthInvalid"),
  height: z.number().int().positive("validation.imageHeightInvalid"),
});

const nullableTrimmedString = z
  .string()
  .trim()
  .transform((val) => (val === "" ? null : val))
  .nullable()
  .optional()
  .default(null);

const optionalTranslatedDescription = z
  .string()
  .trim()
  .max(2000, "validation.descriptionMax")
  .transform((val) => (val === "" ? null : val))
  .nullable()
  .optional()
  .default(null);

const featureListSchema = z
  .array(
    z
      .string()
      .trim()
      .min(1, "validation.featureEmpty")
      .max(120, "validation.featureMax")
  )
  .max(40, "validation.featuresLimit")
  .default([]);

const emptyToNull = (val: unknown) =>
  val === "" || val === null || val === undefined ? null : val;

export const carSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .min(2, "validation.slugMin")
      .max(120, "validation.slugMax")
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "validation.slugFormat"),
    brand: z
      .string()
      .trim()
      .min(1, "validation.brandRequired")
      .max(80, "validation.brandMax"),
    model: z
      .string()
      .trim()
      .min(1, "validation.modelRequired")
      .max(120, "validation.modelMax"),
    year: z.coerce
      .number()
      .int("validation.yearInt")
      .min(1990, "validation.yearMin")
      .max(MAX_MODEL_YEAR, "validation.yearMax"),
    price: z.preprocess(
      emptyToNull,
      z
        .union([
          z.null(),
          z.coerce
            .number()
            .int("validation.priceInt")
            .min(0, "validation.priceMin"),
        ])
        .default(null)
    ),
    price_on_request: z.boolean().default(false),
    mileage: z.coerce
      .number()
      .int("validation.mileageInt")
      .min(0, "validation.mileageMin")
      .default(0),
    fuel: z.enum(FUEL_VALUES, {
      error: "validation.fuelInvalid",
    }),
    transmission: z.enum(TRANSMISSION_VALUES, {
      error: "validation.transmissionInvalid",
    }),
    body_type: z.enum(BODY_TYPE_VALUES, {
      error: "validation.bodyTypeInvalid",
    }),
    color: nullableTrimmedString,
    power: nullableTrimmedString,
    engine: nullableTrimmedString,
    doors: z.preprocess(
      emptyToNull,
      z
        .union([
          z.null(),
          z.coerce
            .number()
            .int("validation.doorsInt")
            .min(2, "validation.doorsMin")
            .max(6, "validation.doorsMax"),
        ])
        .default(null)
    ),
    seats: z.preprocess(
      emptyToNull,
      z
        .union([
          z.null(),
          z.coerce
            .number()
            .int("validation.seatsInt")
            .min(1, "validation.seatsMin")
            .max(9, "validation.seatsMax"),
        ])
        .default(null)
    ),
    condition: z.enum(CONDITION_VALUES, {
      error: "validation.conditionInvalid",
    }),
    status: z
      .enum(STATUS_VALUES, {
        error: "validation.statusInvalid",
      })
      .default("Disponible"),
    featured: z.boolean().default(false),
    published: z.boolean().default(true),
    description: z
      .string()
      .trim()
      .min(1, "validation.descriptionRequired")
      .max(2000, "validation.descriptionMax"),
    description_en: optionalTranslatedDescription,
    description_ar: optionalTranslatedDescription,
    features: featureListSchema,
    features_en: featureListSchema,
    features_ar: featureListSchema,
    images: z.array(carImageSchema).default([]),
  })
  .superRefine((data, ctx) => {
    if (
      !data.price_on_request &&
      (data.price === null || data.price === undefined)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["price"],
        message: "validation.priceRequired",
      });
    }
  });

export type CarInput = z.input<typeof carSchema>;
export type CarValidated = z.output<typeof carSchema>;
