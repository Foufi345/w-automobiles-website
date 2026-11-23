import "server-only";
import { createHash } from "node:crypto";

export const CLOUDINARY_CARS_FOLDER = "w-automobiles/cars";
export const CLOUDINARY_ALLOWED_FORMATS = "jpg,jpeg,png,webp";

function getCloudinaryServerConfig() {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Configuration Cloudinary manquante (NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, NEXT_PUBLIC_CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)."
    );
  }

  return { cloudName, apiKey, apiSecret };
}

/**
 * Generates a Cloudinary SHA-1 signature over sorted parameter key=value pairs.
 */
export function signCloudinaryParams(
  params: Record<string, string | number>
): string {
  const { apiSecret } = getCloudinaryServerConfig();

  const sorted = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== "")
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");

  return createHash("sha1")
    .update(`${sorted}${apiSecret}`)
    .digest("hex");
}

/**
 * Creates a server-signed upload payload with strictly server-fixed parameters.
 * Never signs any client-supplied parameter.
 */
export function createSignedCarUploadParams() {
  const { cloudName, apiKey } = getCloudinaryServerConfig();
  const timestamp = Math.floor(Date.now() / 1000);

  const paramsToSign = {
    allowed_formats: CLOUDINARY_ALLOWED_FORMATS,
    folder: CLOUDINARY_CARS_FOLDER,
    timestamp,
  };

  const signature = signCloudinaryParams(paramsToSign);

  return {
    cloudName,
    apiKey,
    timestamp,
    signature,
    folder: CLOUDINARY_CARS_FOLDER,
    allowedFormats: CLOUDINARY_ALLOWED_FORMATS,
  };
}

/**
 * Deletes Cloudinary images by public_id (restricted to w-automobiles/cars/*).
 * Only callable from verified admin server actions / route handlers.
 */
export async function deleteCloudinaryImages(
  publicIds: string[]
): Promise<{ deleted: string[]; failed: string[] }> {
  const uniqueIds = Array.from(
    new Set(
      publicIds
        .map((id) => id.trim())
        .filter((id) => id.startsWith(`${CLOUDINARY_CARS_FOLDER}/`))
    )
  );

  if (uniqueIds.length === 0) {
    return { deleted: [], failed: [] };
  }

  const { cloudName, apiKey } = getCloudinaryServerConfig();
  const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`;

  const deleted: string[] = [];
  const failed: string[] = [];

  await Promise.all(
    uniqueIds.map(async (publicId) => {
      try {
        const timestamp = Math.floor(Date.now() / 1000);
        const signature = signCloudinaryParams({
          invalidate: "true",
          public_id: publicId,
          timestamp,
        });

        const body = new URLSearchParams({
          public_id: publicId,
          api_key: apiKey,
          timestamp: String(timestamp),
          signature,
          invalidate: "true",
        });

        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: body.toString(),
          cache: "no-store",
        });

        if (res.ok) {
          deleted.push(publicId);
        } else {
          failed.push(publicId);
        }
      } catch {
        failed.push(publicId);
      }
    })
  );

  return { deleted, failed };
}
