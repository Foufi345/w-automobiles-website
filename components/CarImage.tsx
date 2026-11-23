"use client";

import { useEffect, useState } from "react";
import Image, { type ImageLoaderProps } from "next/image";
import { cldUrl, getCarPlaceholderImage } from "@/lib/cloudinary-url";

interface CarImageProps {
  /** Cloudinary public_id, full Cloudinary URL, or local image path */
  src?: string | null;
  /** Optional car slug used to pick the local placeholder when src is empty */
  slug?: string;
  alt: string;
  sizes?: string;
  priority?: boolean;
  fill?: boolean;
  width?: number;
  height?: number;
  className?: string;
}

const FALLBACK_HERO = "/images/showroom-hero.jpg";

function isCloudinaryUrl(url: string): boolean {
  return url.includes("res.cloudinary.com/");
}

function cloudinaryImageLoader({ src, width, quality }: ImageLoaderProps): string {
  // If src is a full Cloudinary URL with /upload/..., inject or replace width transform
  if (isCloudinaryUrl(src)) {
    return src.replace(
      /\/image\/upload\/(?:[^/]+\/)?/,
      `/image/upload/f_auto,q_${quality ?? "auto"},w_${width},c_limit/`
    );
  }
  return cldUrl(src, { width, quality: quality ?? "auto" });
}

export function CarImage({
  src,
  slug,
  alt,
  sizes = "(max-width: 767px) 100vw, 440px",
  priority = false,
  fill = true,
  width,
  height,
  className = "object-cover",
}: CarImageProps) {
  const initialSrc =
    src && src.trim().length > 0 ? src : getCarPlaceholderImage(slug);
  const [currentSrc, setCurrentSrc] = useState(initialSrc);

  useEffect(() => {
    setCurrentSrc(
      src && src.trim().length > 0 ? src : getCarPlaceholderImage(slug)
    );
  }, [src, slug]);

  const useCustomLoader =
    isCloudinaryUrl(currentSrc) ||
    (!currentSrc.startsWith("/") && !currentSrc.startsWith("http"));

  const handleError = () => {
    if (currentSrc !== FALLBACK_HERO) {
      setCurrentSrc(FALLBACK_HERO);
    }
  };

  if (fill) {
    return (
      <Image
        src={currentSrc}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        loader={useCustomLoader ? cloudinaryImageLoader : undefined}
        onError={handleError}
        className={className}
      />
    );
  }

  return (
    <Image
      src={currentSrc}
      alt={alt}
      width={width ?? 800}
      height={height ?? 600}
      sizes={sizes}
      priority={priority}
      loader={useCustomLoader ? cloudinaryImageLoader : undefined}
      onError={handleError}
      className={className}
    />
  );
}
