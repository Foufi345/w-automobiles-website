"use server";

import { requireAdmin } from "@/lib/auth/requireAdmin";
import { deleteCloudinaryImages } from "@/lib/cloudinary-server";

/**
 * Deletes uploaded-but-unsaved Cloudinary images when the admin cancels a form.
 */
export async function cleanupUnsavedCloudinaryImagesAction(
  publicIds: string[]
): Promise<{ deleted: string[]; failed: string[] }> {
  await requireAdmin({ onUnauthorized: "throw" });
  if (!Array.isArray(publicIds) || publicIds.length === 0) {
    return { deleted: [], failed: [] };
  }
  return deleteCloudinaryImages(publicIds.slice(0, 50));
}
