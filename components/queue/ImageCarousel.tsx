"use client";

import { RefObject } from "react";

interface LabelImage {
  path: string;
  mimeType: string;
  side?: string;
}

interface ImageCarouselProps {
  images: LabelImage[];
  activeImageIndex: number;
  selectedField: string | null;
  hasBoundingBoxes: boolean;
  onImageChange: (index: number) => void;
  imgRef: RefObject<HTMLImageElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
}

export function ImageCarousel({
  images,
  activeImageIndex,
  hasBoundingBoxes,
  onImageChange,
  imgRef,
  canvasRef,
}: ImageCarouselProps) {
  const activeImage = images[activeImageIndex];
  const hasMultipleImages = images.length > 1;

  function handleNav(index: number) {
    onImageChange(index);
  }

  return (
    <div>
      <div className="relative inline-block">
        <img
          ref={imgRef}
          src={activeImage.path}
          alt={activeImage.side ? `${activeImage.side} label` : `Label ${activeImageIndex + 1}`}
          className="max-h-96 rounded-lg object-contain block border border-outline"
        />
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="absolute top-0 left-0 rounded-lg pointer-events-none"
        />
      </div>

      {hasMultipleImages && (
        <div className="flex items-center justify-between mt-3">
          <button
            onClick={() => handleNav(activeImageIndex - 1)}
            disabled={activeImageIndex === 0}
            className="px-3 py-1 text-sm border border-outline rounded-lg text-on-surface-dim disabled:opacity-30">
            ←
          </button>
          <div className="flex items-center gap-2">
            {images.map((img, i) => (
              <button
                key={i}
                onClick={() => handleNav(i)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === activeImageIndex ? "bg-primary" : "bg-outline"
                }`}
              />
            ))}
            <span className="text-xs text-on-surface-muted ml-1">
              {activeImage.side ?
                activeImage.side.charAt(0).toUpperCase() + activeImage.side.slice(1)
              : `${activeImageIndex + 1} / ${images.length}`}
            </span>
          </div>
          <button
            onClick={() => handleNav(activeImageIndex + 1)}
            disabled={activeImageIndex === images.length - 1}
            className="px-3 py-1 text-sm border border-outline rounded-lg text-on-surface-dim disabled:opacity-30">
            →
          </button>
        </div>
      )}

      {hasBoundingBoxes && (
        <p className="text-xs text-on-surface-muted mt-2">
          Click a field to highlight its location on the label.
          {hasMultipleImages && " The view will jump to the correct label automatically."}
        </p>
      )}
    </div>
  );
}
