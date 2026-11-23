"use server";

import { z } from "zod";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { deleteCloudinaryImages } from "@/lib/cloudinary-server";
import { revalidateCars } from "@/lib/revalidate";
import { carSchema, STATUS_VALUES, type CarInput } from "@/lib/validation/car";
import type { CarImage, CarRow, CarStatus } from "@/types/database";

const MAX_FEATURED_CARS = 6;

export interface ActionResult<T = undefined> {
  ok: boolean;
  /** Translation key under `admin` (e.g. `serverErrors.featuredLimit`) or raw fallback */
  error?: string;
  errorParams?: Record<string, string | number>;
  fieldErrors?: Record<string, string>;
  data?: T;
}

function extractPublicIds(rawImages: unknown): string[] {
  if (!Array.isArray(rawImages)) return [];
  return rawImages
    .map((img) =>
      typeof img === "object" && img !== null && "public_id" in img
        ? String((img as CarImage).public_id || "").trim()
        : ""
    )
    .filter(Boolean);
}

/**
 * Deletes Cloudinary images ONLY if they are not still referenced by any other car
 * (protects duplicated vehicles sharing Cloudinary public_ids).
 */
export async function deleteOrphanedCloudinaryImages(
  candidatePublicIds: string[],
  excludeCarId?: string
): Promise<void> {
  const uniqueCandidates = Array.from(
    new Set(candidatePublicIds.map((id) => id.trim()).filter(Boolean))
  );
  if (uniqueCandidates.length === 0) return;

  const { supabase } = await requireAdmin({ onUnauthorized: "throw" });

  let query = supabase.from("cars").select("id, images");
  if (excludeCarId) {
    query = query.neq("id", excludeCarId);
  }

  const { data: otherCars, error } = await query;
  if (error) {
    // Fail safe: never delete Cloudinary images if we couldn't verify references
    return;
  }

  const stillReferenced = new Set<string>();
  for (const row of otherCars ?? []) {
    for (const pid of extractPublicIds(row.images)) {
      stillReferenced.add(pid);
    }
  }

  const orphaned = uniqueCandidates.filter((pid) => !stillReferenced.has(pid));
  if (orphaned.length > 0) {
    await deleteCloudinaryImages(orphaned);
  }
}

export async function toggleFeaturedAction(
  id: string,
  nextFeatured: boolean
): Promise<ActionResult<{ featured: boolean }>> {
  try {
    const { supabase } = await requireAdmin({ onUnauthorized: "throw" });

    if (nextFeatured) {
      const { count, error: countError } = await supabase
        .from("cars")
        .select("id", { count: "exact", head: true })
        .eq("featured", true)
        .neq("id", id);

      if (countError) {
        return { ok: false, error: "serverErrors.featuredCheckFailed" };
      }

      if ((count ?? 0) >= MAX_FEATURED_CARS) {
        return {
          ok: false,
          error: "serverErrors.featuredLimit",
        };
      }
    }

    const { data, error } = await supabase
      .from("cars")
      .update({ featured: nextFeatured })
      .eq("id", id)
      .select("slug, featured")
      .single();

    if (error || !data) {
      return { ok: false, error: "serverErrors.featuredUpdateFailed" };
    }

    revalidateCars(data.slug);
    return { ok: true, data: { featured: data.featured } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "serverErrors.serverError",
    };
  }
}

export async function togglePublishedAction(
  id: string,
  nextPublished: boolean
): Promise<ActionResult<{ published: boolean }>> {
  try {
    const { supabase } = await requireAdmin({ onUnauthorized: "throw" });

    const { data, error } = await supabase
      .from("cars")
      .update({ published: nextPublished })
      .eq("id", id)
      .select("slug, published")
      .single();

    if (error || !data) {
      return { ok: false, error: "serverErrors.publishedUpdateFailed" };
    }

    revalidateCars(data.slug);
    return { ok: true, data: { published: data.published } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "serverErrors.serverError",
    };
  }
}

const statusSchema = z.enum(STATUS_VALUES);

export async function updateCarStatusAction(
  id: string,
  nextStatus: CarStatus
): Promise<ActionResult<{ status: CarStatus }>> {
  try {
    const parsed = statusSchema.safeParse(nextStatus);
    if (!parsed.success) {
      return { ok: false, error: "serverErrors.statusInvalid" };
    }

    const { supabase } = await requireAdmin({ onUnauthorized: "throw" });

    const { data, error } = await supabase
      .from("cars")
      .update({ status: parsed.data })
      .eq("id", id)
      .select("slug, status")
      .single();

    if (error || !data) {
      return { ok: false, error: "serverErrors.statusUpdateFailed" };
    }

    revalidateCars(data.slug);
    return { ok: true, data: { status: data.status } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "serverErrors.serverError",
    };
  }
}

export async function duplicateCarAction(
  id: string
): Promise<ActionResult<{ car: CarRow }>> {
  try {
    const { supabase } = await requireAdmin({ onUnauthorized: "throw" });

    const { data: source, error: fetchError } = await supabase
      .from("cars")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !source) {
      return { ok: false, error: "serverErrors.notFound" };
    }

    // Generate a unique slug: <slug>-copie, <slug>-copie-2, ...
    const baseSlug = `${source.slug}-copie`;
    const { data: existingSlugs } = await supabase
      .from("cars")
      .select("slug")
      .like("slug", `${baseSlug}%`);

    const taken = new Set((existingSlugs ?? []).map((r) => r.slug));
    let candidateSlug = baseSlug;
    let suffix = 2;
    while (taken.has(candidateSlug)) {
      candidateSlug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    const { data: inserted, error: insertError } = await supabase
      .from("cars")
      .insert({
        slug: candidateSlug,
        brand: source.brand,
        model: `${source.model} (Copie)`,
        year: source.year,
        price: source.price,
        price_on_request: source.price_on_request,
        mileage: source.mileage,
        fuel: source.fuel,
        transmission: source.transmission,
        body_type: source.body_type,
        color: source.color,
        power: source.power,
        engine: source.engine,
        doors: source.doors,
        seats: source.seats,
        condition: source.condition,
        status: "Disponible",
        featured: false,
        published: false,
        description: source.description,
        description_en: source.description_en ?? null,
        description_ar: source.description_ar ?? null,
        features: source.features ?? [],
        features_en: source.features_en ?? [],
        features_ar: source.features_ar ?? [],
        images: source.images ?? [],
      })
      .select("*")
      .single();

    if (insertError || !inserted) {
      return {
        ok: false,
        error: insertError?.message ?? "serverErrors.duplicateFailed",
      };
    }

    revalidateCars(inserted.slug);
    return { ok: true, data: { car: inserted } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "serverErrors.serverError",
    };
  }
}

export async function deleteCarAction(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const { supabase } = await requireAdmin({ onUnauthorized: "throw" });

    const { data: target, error: fetchError } = await supabase
      .from("cars")
      .select("id, slug, images")
      .eq("id", id)
      .single();

    if (fetchError || !target) {
      return { ok: false, error: "serverErrors.notFound" };
    }

    const { error: deleteError } = await supabase
      .from("cars")
      .delete()
      .eq("id", id);

    if (deleteError) {
      return { ok: false, error: "serverErrors.deleteFailed" };
    }

    // Delete Cloudinary photos ONLY if not referenced by any remaining vehicle
    const publicIds = extractPublicIds(target.images);
    if (publicIds.length > 0) {
      await deleteOrphanedCloudinaryImages(publicIds, id);
    }

    revalidateCars(target.slug);
    return { ok: true, data: { id } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "serverErrors.serverError",
    };
  }
}

async function findAvailableSlugSuggestion(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  baseSlug: string,
  excludeId?: string
): Promise<string> {
  let query = supabase
    .from("cars")
    .select("id, slug")
    .like("slug", `${baseSlug}%`);
  if (excludeId) {
    query = query.neq("id", excludeId);
  }
  const { data } = await query;
  const taken = new Set((data ?? []).map((r) => r.slug));
  if (!taken.has(baseSlug)) return baseSlug;

  let n = 2;
  while (taken.has(`${baseSlug}-${n}`)) {
    n += 1;
  }
  return `${baseSlug}-${n}`;
}

export async function checkSlugAvailabilityAction(
  slug: string,
  excludeId?: string
): Promise<{ available: boolean; suggestion?: string }> {
  try {
    const { supabase } = await requireAdmin({ onUnauthorized: "throw" });
    const clean = slug.trim().toLowerCase();
    if (!clean) return { available: false };

    let query = supabase.from("cars").select("id").eq("slug", clean);
    if (excludeId) {
      query = query.neq("id", excludeId);
    }
    const { data } = await query.maybeSingle();
    if (!data) {
      return { available: true };
    }
    const suggestion = await findAvailableSlugSuggestion(
      supabase,
      clean,
      excludeId
    );
    return { available: false, suggestion };
  } catch {
    return { available: true };
  }
}

function collectZodFieldErrors(issues: z.ZodIssue[]): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    if (!fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}

export async function createCarAction(
  input: CarInput,
  unsavedUploadedIds: string[] = []
): Promise<ActionResult<{ id: string; slug: string }>> {
  try {
    const { supabase } = await requireAdmin({ onUnauthorized: "throw" });

    const parsed = carSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: "serverErrors.fixFields",
        fieldErrors: collectZodFieldErrors(parsed.error.issues),
      };
    }

    const data = parsed.data;

    // Check slug uniqueness
    const { data: existingSlug } = await supabase
      .from("cars")
      .select("id")
      .eq("slug", data.slug)
      .maybeSingle();

    if (existingSlug) {
      const suggestion = await findAvailableSlugSuggestion(supabase, data.slug);
      return {
        ok: false,
        error: "serverErrors.slugTaken",
        errorParams: { suggestion },
        fieldErrors: {
          slug: "serverErrors.slugTaken",
        },
      };
    }

    // Check featured limit (max 6)
    if (data.featured) {
      const { count } = await supabase
        .from("cars")
        .select("id", { count: "exact", head: true })
        .eq("featured", true);
      if ((count ?? 0) >= MAX_FEATURED_CARS) {
        return {
          ok: false,
          error: "serverErrors.featuredLimit",
          fieldErrors: {
            featured: "serverErrors.featuredLimit",
          },
        };
      }
    }

    const { data: inserted, error } = await supabase
      .from("cars")
      .insert({
        slug: data.slug,
        brand: data.brand,
        model: data.model,
        year: data.year,
        price: data.price_on_request ? null : data.price,
        price_on_request: data.price_on_request,
        mileage: data.mileage,
        fuel: data.fuel,
        transmission: data.transmission,
        body_type: data.body_type,
        color: data.color,
        power: data.power,
        engine: data.engine,
        doors: data.doors,
        seats: data.seats,
        condition: data.condition,
        status: data.status,
        featured: data.featured,
        published: data.published,
        description: data.description,
        description_en: data.description_en,
        description_ar: data.description_ar,
        features: data.features,
        features_en: data.features_en,
        features_ar: data.features_ar,
        images: data.images,
      })
      .select("id, slug")
      .single();

    if (error || !inserted) {
      return {
        ok: false,
        error: error?.message ?? "serverErrors.createFailed",
      };
    }

    // Delete any images uploaded during this session that were removed before saving
    const keptIds = new Set(data.images.map((img) => img.public_id));
    const orphaned = unsavedUploadedIds.filter((pid) => !keptIds.has(pid));
    if (orphaned.length > 0) {
      await deleteOrphanedCloudinaryImages(orphaned, inserted.id);
    }

    revalidateCars(inserted.slug);
    return { ok: true, data: { id: inserted.id, slug: inserted.slug } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "serverErrors.serverError",
    };
  }
}

export async function updateCarAction(
  id: string,
  input: CarInput,
  unsavedUploadedIds: string[] = [],
  expectedUpdatedAt?: string
): Promise<ActionResult<{ id: string; slug: string }>> {
  try {
    const { supabase } = await requireAdmin({ onUnauthorized: "throw" });

    const parsed = carSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: "serverErrors.fixFields",
        fieldErrors: collectZodFieldErrors(parsed.error.issues),
      };
    }

    const data = parsed.data;

    // Fetch existing row for old slug, old images diff, and concurrent-edit check
    const { data: existing, error: fetchError } = await supabase
      .from("cars")
      .select("id, slug, images, updated_at")
      .eq("id", id)
      .maybeSingle();

    if (fetchError || !existing) {
      return { ok: false, error: "serverErrors.notFound" };
    }

    // Concurrent edit protection: reject stale writes
    if (
      expectedUpdatedAt &&
      existing.updated_at &&
      existing.updated_at !== expectedUpdatedAt
    ) {
      return {
        ok: false,
        error: "serverErrors.staleEdit",
      };
    }

    // Check slug uniqueness (excluding self)
    const { data: conflictingSlug } = await supabase
      .from("cars")
      .select("id")
      .eq("slug", data.slug)
      .neq("id", id)
      .maybeSingle();

    if (conflictingSlug) {
      const suggestion = await findAvailableSlugSuggestion(
        supabase,
        data.slug,
        id
      );
      return {
        ok: false,
        error: "serverErrors.slugTaken",
        errorParams: { suggestion },
        fieldErrors: {
          slug: "serverErrors.slugTaken",
        },
      };
    }

    // Check featured limit (max 6 excluding self)
    if (data.featured) {
      const { count } = await supabase
        .from("cars")
        .select("id", { count: "exact", head: true })
        .eq("featured", true)
        .neq("id", id);
      if ((count ?? 0) >= MAX_FEATURED_CARS) {
        return {
          ok: false,
          error: "serverErrors.featuredLimit",
          fieldErrors: {
            featured: "serverErrors.featuredLimit",
          },
        };
      }
    }

    const { data: updated, error } = await supabase
      .from("cars")
      .update({
        slug: data.slug,
        brand: data.brand,
        model: data.model,
        year: data.year,
        price: data.price_on_request ? null : data.price,
        price_on_request: data.price_on_request,
        mileage: data.mileage,
        fuel: data.fuel,
        transmission: data.transmission,
        body_type: data.body_type,
        color: data.color,
        power: data.power,
        engine: data.engine,
        doors: data.doors,
        seats: data.seats,
        condition: data.condition,
        status: data.status,
        featured: data.featured,
        published: data.published,
        description: data.description,
        description_en: data.description_en,
        description_ar: data.description_ar,
        features: data.features,
        features_en: data.features_en,
        features_ar: data.features_ar,
        images: data.images,
      })
      .eq("id", id)
      .select("id, slug")
      .single();

    if (error || !updated) {
      return {
        ok: false,
        error: error?.message ?? "serverErrors.updateFailed",
      };
    }

    // Delete orphaned Cloudinary images (removed from old list OR uploaded-then-removed during edit)
    const keptIds = new Set(data.images.map((img) => img.public_id));
    const oldIds = extractPublicIds(existing.images);
    const candidates = [...oldIds, ...unsavedUploadedIds].filter(
      (pid) => !keptIds.has(pid)
    );
    if (candidates.length > 0) {
      await deleteOrphanedCloudinaryImages(candidates, id);
    }

    revalidateCars(updated.slug);
    if (existing.slug !== updated.slug) {
      revalidateCars(existing.slug);
    }

    return { ok: true, data: { id: updated.id, slug: updated.slug } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "serverErrors.serverError",
    };
  }
}
