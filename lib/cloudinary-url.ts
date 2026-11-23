export interface CloudinaryTransformOptions {
  width?: number;
  quality?: "auto" | "auto:eco" | "auto:good" | "auto:best" | number;
  cloudName?: string;
}

/**
 * Injects or replaces Cloudinary delivery transforms on an existing res.cloudinary.com URL.
 */
export function transformCloudinaryUrl(
  url: string,
  options: Omit<CloudinaryTransformOptions, "cloudName"> = {}
): string {
  if (!url.includes("res.cloudinary.com/")) return url;
  const transforms: string[] = [
    "f_auto",
    `q_${options.quality ?? "auto"}`,
  ];
  if (options.width && options.width > 0) {
    transforms.push(`w_${Math.round(options.width)}`, "c_limit");
  }
  return url.replace(
    /\/image\/upload\/(?:[^/]+\/)?(?=v\d+\/|w-automobiles\/|[^/]+$)/,
    `/image/upload/${transforms.join(",")}/`
  );
}

/**
 * Builds an optimized Cloudinary delivery URL with f_auto, q_auto, w_<w>, c_limit.
 * Example:
 *   https://res.cloudinary.com/<cloud>/image/upload/f_auto,q_auto,w_800,c_limit/<public_id>
 */
export function cldUrl(
  publicId: string,
  options: CloudinaryTransformOptions = {}
): string {
  const cloudName =
    options.cloudName?.trim() ||
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim();
  const cleanId = publicId.replace(/^\/+/, "");

  // If already a full Cloudinary URL, apply/update transforms directly
  if (cleanId.startsWith("https://res.cloudinary.com/")) {
    return transformCloudinaryUrl(publicId, options);
  }

  // If already another full URL or local fallback path, return as-is
  if (
    cleanId.startsWith("http://") ||
    cleanId.startsWith("https://") ||
    publicId.startsWith("/")
  ) {
    return publicId;
  }

  if (!cloudName) {
    return "/images/showroom-hero.jpg";
  }

  const transforms: string[] = [
    "f_auto",
    `q_${options.quality ?? "auto"}`,
  ];

  if (options.width && options.width > 0) {
    transforms.push(`w_${Math.round(options.width)}`, "c_limit");
  }

  return `https://res.cloudinary.com/${cloudName}/image/upload/${transforms.join(",")}/${cleanId}`;
}

/**
 * Fallback placeholder image when a car has no uploaded photos yet.
 */
export function getCarPlaceholderImage(_slug?: string): string {
  return "/images/showroom-hero.jpg";
}
