"use client";

import { CarImage } from "@/components/CarImage";

interface DistortImageProps {
  src: string;
  slug?: string;
  alt: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
  aspectRatio?: string;
  enableParallax?: boolean;
}

export function DistortImage({
  src,
  slug,
  alt,
  sizes = "(max-width: 767px) 100vw, 400px",
  priority = false,
  className = "",
  aspectRatio = "aspect-[4/3]",
}: DistortImageProps) {
  const inlineAspect = aspectRatio.includes("3/2") ? "3 / 2" : "4 / 3";

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: inlineAspect,
        overflow: "hidden",
      }}
      className={`group/distort relative w-full overflow-hidden ${aspectRatio} ${className}`}
    >
      <CarImage
        src={src}
        slug={slug}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className="object-cover transition-transform duration-500 group-hover/distort:scale-[1.04]"
      />
    </div>
  );
}
