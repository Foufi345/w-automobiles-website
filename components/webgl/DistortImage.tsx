"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { CarImage } from "@/components/CarImage";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useWebGLSupport } from "@/hooks/useWebGLSupport";

const DistortImageCanvas = dynamic(() => import("./DistortImageCanvas"), {
  ssr: false,
});

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
  enableParallax = false,
}: DistortImageProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [firstFrameRendered, setFirstFrameRendered] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const isReducedMotion = useReducedMotion();
  const { canRender3D, isMobile } = useWebGLSupport();

  const shouldEnableWebGL =
    canRender3D && !isMobile && !isReducedMotion && !timedOut;
  const isActive = shouldEnableWebGL && (enableParallax || isHovered);

  // Reset timeout state if image src changes
  useEffect(() => {
    setTimedOut(false);
    setFirstFrameRendered(false);
  }, [src]);

  const handleFirstFrame = useCallback(() => setFirstFrameRendered(true), []);
  const handleContextLost = useCallback(() => setFirstFrameRendered(false), []);
  const handleTimeout = useCallback(() => setTimedOut(true), []);

  const inlineAspect = aspectRatio.includes("3/2") ? "3 / 2" : "4 / 3";

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: inlineAspect,
        overflow: "hidden",
      }}
      className={`group/distort relative w-full overflow-hidden ${aspectRatio} ${className}`}
    >
      {/* Real next/image via CarImage (Cloudinary loader + placeholder fallback): ALWAYS visible underneath */}
      <CarImage
        src={src}
        slug={slug}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className="object-cover transition-transform duration-500 group-hover/distort:scale-[1.04]"
      />

      {/* WebGL Canvas overlay: dynamically loaded ONLY on desktop hover/parallax so Three.js is never in mobile initial JS */}
      {isActive && (
        <DistortImageCanvas
          src={src}
          containerRef={containerRef}
          isHovered={isHovered}
          enableParallax={enableParallax}
          firstFrameRendered={firstFrameRendered}
          onFirstFrame={handleFirstFrame}
          onContextLost={handleContextLost}
          onTimeout={handleTimeout}
        />
      )}
    </div>
  );
}
