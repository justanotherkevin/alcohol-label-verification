"use client";

import { useEffect, useRef, useState } from "react";
import { BoundingBox } from "@/lib/ocr/types";
import { ImageExpandModal } from "@/components/queue/ImageExpandModal";

interface LabelImage {
  path: string;
  mimeType: string;
  side?: string;
}

interface LabelRegionPanelProps {
  images: LabelImage[];
  fieldLabel: string;
  fieldNumber: number;
  extractedText: string | null;
  boxes: BoundingBox[];
}

const CROP_PADDING = 0.15;
const CANVAS_WIDTH = 420;
const CANVAS_HEIGHT = 260;

export function LabelRegionPanel({
  images,
  fieldLabel,
  fieldNumber,
  extractedText,
  boxes,
}: LabelRegionPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [expandOpen, setExpandOpen] = useState(false);
  const primaryImageIndex = boxes[0]?.imageIndex ?? 0;
  const [expandImageIndex, setExpandImageIndex] = useState(primaryImageIndex);
  const thumbImage = images[primaryImageIndex];
  // Only boxes on the same image can share one crop; boxes on other images
  // (e.g. a front/back split) aren't drawn in this thumbnail.
  const boxesOnImage = boxes.filter((b) => b.imageIndex === primaryImageIndex);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || boxesOnImage.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const image = images[primaryImageIndex];
    if (!image) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      const unionX0 = Math.min(...boxesOnImage.map((b) => b.x));
      const unionY0 = Math.min(...boxesOnImage.map((b) => b.y));
      const unionX1 = Math.max(...boxesOnImage.map((b) => b.x + b.width));
      const unionY1 = Math.max(...boxesOnImage.map((b) => b.y + b.height));
      const unionW = unionX1 - unionX0;
      const unionH = unionY1 - unionY0;

      const padX = unionW * CROP_PADDING;
      const padY = unionH * CROP_PADDING;
      const cropX = Math.max(0, unionX0 - padX);
      const cropY = Math.max(0, unionY0 - padY);
      const cropW = Math.min(1 - cropX, unionW + padX * 2);
      const cropH = Math.min(1 - cropY, unionH + padY * 2);

      const sx = cropX * img.naturalWidth;
      const sy = cropY * img.naturalHeight;
      const sW = cropW * img.naturalWidth;
      const sH = cropH * img.naturalHeight;

      const scale = Math.min(CANVAS_WIDTH / sW, CANVAS_HEIGHT / sH);
      const drawW = sW * scale;
      const drawH = sH * scale;
      const dx = (CANVAS_WIDTH - drawW) / 2;
      const dy = (CANVAS_HEIGHT - drawH) / 2;

      ctx.drawImage(img, sx, sy, sW, sH, dx, dy, drawW, drawH);

      for (const bbox of boxesOnImage) {
        const boxX = dx + ((bbox.x - cropX) / cropW) * drawW;
        const boxY = dy + ((bbox.y - cropY) / cropH) * drawH;
        const boxW = (bbox.width / cropW) * drawW;
        const boxH = (bbox.height / cropH) * drawH;
        ctx.strokeStyle = "#f97316";
        ctx.lineWidth = 2;
        ctx.strokeRect(boxX, boxY, boxW, boxH);

        if (typeof bbox.confidence === "number" && bbox.confidence < 1) {
          const label = `${Math.round(bbox.confidence * 100)}%`;
          ctx.font = "bold 11px sans-serif";
          const textWidth = ctx.measureText(label).width;
          const labelX = boxX;
          const labelY = Math.max(0, boxY - 4);
          ctx.fillStyle = "#f97316";
          ctx.fillRect(labelX, labelY - 12, textWidth + 6, 14);
          ctx.fillStyle = "#ffffff";
          ctx.fillText(label, labelX + 3, labelY - 2);
        }
      }
    };
    img.src = image.path;
  }, [boxesOnImage, images, primaryImageIndex]);

  return (
    <div className="bg-surface-card rounded-lg p-6 flex flex-col gap-4 h-full">
      <p className="text-sm uppercase tracking-wide text-on-surface-muted">
        Label region · Field {fieldNumber}
      </p>

      {boxesOnImage.length > 0 && (
        <div
          className="rounded-lg bg-outline/20 border border-outline flex items-center justify-center overflow-hidden"
          style={{ height: CANVAS_HEIGHT }}>
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            aria-hidden="true"
          />
        </div>
      )}

      {boxesOnImage.length === 0 && (
        <div
          className="rounded-lg bg-outline/20 border border-outline flex items-center justify-center"
          style={{ height: CANVAS_HEIGHT }}>
          <p className="text-base text-on-surface-dim px-6 text-center">No location found on label</p>
        </div>
      )}

      <p className="text-center text-base font-mono text-on-surface">{extractedText ?? "not found"}</p>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {images.map((image, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => {
              setExpandImageIndex(idx);
              setExpandOpen(true);
            }}
            aria-label={`Expand label image ${idx + 1} of ${images.length}${image.side ? ` (${image.side})` : ""}`}
            className="cursor-pointer flex-shrink-0 rounded border border-outline hover:border-primary transition-colors">
            <img
              src={image.path}
              alt={`Label image ${idx + 1}${image.side ? ` - ${image.side}` : ""}`}
              className="h-24 w-auto object-contain"
            />
          </button>
        ))}
      </div>

      {expandOpen && images[expandImageIndex] && (
        <ImageExpandModal
          image={images[expandImageIndex]}
          boxes={boxes.filter((b) => b.imageIndex === expandImageIndex)}
          fieldLabel={fieldLabel}
          onClose={() => setExpandOpen(false)}
        />
      )}
    </div>
  );
}
