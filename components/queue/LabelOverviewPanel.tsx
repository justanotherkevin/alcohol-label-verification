"use client";

import { useState } from "react";
import { BoundingBoxMap } from "@/lib/ocr/types";
import { FieldResult } from "@/lib/verify";
import { ImageExpandModal } from "@/components/queue/ImageExpandModal";

interface LabelImage {
  path: string;
  mimeType: string;
  side?: string;
}

interface LabelOverviewPanelProps {
  images: LabelImage[];
  fields: FieldResult[];
  boundingBoxes: BoundingBoxMap | undefined;
}

const BOX_COLORS = [
  "#f97316",
  "#0ea5e9",
  "#a855f7",
  "#22c55e",
  "#eab308",
  "#ec4899",
  "#14b8a6",
];

export function LabelOverviewPanel({
  images,
  fields,
  boundingBoxes,
}: LabelOverviewPanelProps) {
  const [expandIndex, setExpandIndex] = useState<number | null>(null);

  const colorByField = new Map(
    fields.map((f, idx) => [f.field, BOX_COLORS[idx % BOX_COLORS.length]]),
  );

  function boxesForImage(imageIndex: number) {
    return fields.flatMap((f) => {
      const boxes = boundingBoxes?.[f.field as keyof BoundingBoxMap] ?? [];
      return boxes
        .filter((b) => b.imageIndex === imageIndex)
        .map((b) => ({ box: b, field: f }));
    });
  }

  return (
    <div className="bg-surface-card rounded-lg p-6 flex flex-col gap-4 h-full">
      <p className="text-xs uppercase tracking-wide text-on-surface-muted">
        Label overview · all fields
      </p>

      <div className="flex flex-row gap-4 overflow-y-auto">
        {images.map((image, imageIndex) => {
          const boxes = boxesForImage(imageIndex);
          return (
            <button
              key={imageIndex}
              type="button"
              onClick={() => setExpandIndex(imageIndex)}
              aria-label={`Expand label image ${imageIndex + 1} of ${images.length}${image.side ? ` (${image.side})` : ""}`}
              className="cursor-pointer relative rounded-lg bg-outline/20 border border-outline overflow-hidden hover:border-primary transition-colors">
              <img
                src={image.path}
                alt={`Label image ${imageIndex + 1}${image.side ? ` - ${image.side}` : ""}`}
                className="w-full h-auto object-contain"
              />
              {boxes.map(({ box, field }, idx) => (
                <div
                  key={idx}
                  className="absolute border-4"
                  style={{
                    left: `${box.x * 100}%`,
                    top: `${box.y * 100}%`,
                    width: `${box.width * 100}%`,
                    height: `${box.height * 100}%`,
                    borderColor: colorByField.get(field.field),
                  }}
                />
              ))}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {fields.map((f) => (
          <span
            key={f.field}
            className="flex items-center gap-1.5 text-xs text-on-surface-dim">
            <span
              className="w-2.5 h-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: colorByField.get(f.field) }}
            />
            {f.label}
          </span>
        ))}
      </div>

      {expandIndex !== null && images[expandIndex] && (
        <ImageExpandModal
          image={images[expandIndex]}
          boxes={boxesForImage(expandIndex).map((b) => b.box)}
          fieldLabel="All fields"
          onClose={() => setExpandIndex(null)}
        />
      )}
    </div>
  );
}
