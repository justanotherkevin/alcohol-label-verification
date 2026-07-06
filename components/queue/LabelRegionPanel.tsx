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
  bbox: BoundingBox | undefined;
}

const CROP_PADDING = 0.15;
const CANVAS_WIDTH = 420;
const CANVAS_HEIGHT = 260;

export function LabelRegionPanel({
  images,
  fieldLabel,
  fieldNumber,
  extractedText,
  bbox,
}: LabelRegionPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [expandOpen, setExpandOpen] = useState(false);
  const [expandImageIndex, setExpandImageIndex] = useState(bbox?.imageIndex ?? 0);
  const thumbImage = images[bbox?.imageIndex ?? 0];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !bbox) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const image = images[bbox.imageIndex];
    if (!image) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      const padX = bbox.width * CROP_PADDING;
      const padY = bbox.height * CROP_PADDING;
      const cropX = Math.max(0, bbox.x - padX);
      const cropY = Math.max(0, bbox.y - padY);
      const cropW = Math.min(1 - cropX, bbox.width + padX * 2);
      const cropH = Math.min(1 - cropY, bbox.height + padY * 2);

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

      const boxX = dx + ((bbox.x - cropX) / cropW) * drawW;
      const boxY = dy + ((bbox.y - cropY) / cropH) * drawH;
      const boxW = (bbox.width / cropW) * drawW;
      const boxH = (bbox.height / cropH) * drawH;
      ctx.strokeStyle = "#f97316";
      ctx.lineWidth = 2;
      ctx.strokeRect(boxX, boxY, boxW, boxH);
    };
    img.src = image.path;
  }, [bbox, images]);

  return (
    <div className="bg-surface-card rounded-lg p-6 flex flex-col gap-4 h-full">
      <p className="text-xs uppercase tracking-wide text-on-surface-muted">
        Label region · Field {fieldNumber}
      </p>

      {bbox && (
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

      {!bbox && (
        <div
          className="rounded-lg bg-outline/20 border border-outline flex items-center justify-center"
          style={{ height: CANVAS_HEIGHT }}>
          <p className="text-sm text-on-surface-dim px-6 text-center">No location found on label</p>
        </div>
      )}

      <p className="text-center text-sm font-mono text-on-surface">{extractedText ?? "not found"}</p>

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
          bbox={expandImageIndex === (bbox?.imageIndex ?? 0) ? bbox : undefined}
          fieldLabel={fieldLabel}
          onClose={() => setExpandOpen(false)}
        />
      )}
    </div>
  );
}
