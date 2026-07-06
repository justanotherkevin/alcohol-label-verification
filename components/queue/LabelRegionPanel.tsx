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
    <div className="bg-[#1c1c1c] rounded-lg p-6 flex flex-col gap-4 h-full">
      <p className="text-xs uppercase tracking-wide text-white/50">
        Label region · Field {fieldNumber}
      </p>

      <div
        className="rounded-lg bg-black/30 border border-white/10 flex items-center justify-center overflow-hidden"
        style={{ height: CANVAS_HEIGHT }}>
        {bbox ?
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            aria-hidden="true"
          />
        : <p className="text-sm text-white/40 px-6 text-center">No location found on label</p>}
      </div>

      <p className="text-center text-sm font-mono text-white/80">{extractedText ?? "not found"}</p>

      {thumbImage && (
        <button
          type="button"
          onClick={() => setExpandOpen(true)}
          aria-label={`Expand full label image for ${fieldLabel}`}
          className="cursor-pointer mt-auto flex flex-col items-center gap-1">
          <div className="relative inline-block">
            <img
              src={thumbImage.path}
              alt="Full label"
              className="w-28 rounded border border-white/20"
            />
            {bbox && (
              <div
                className="absolute border-2 border-orange-400"
                style={{
                  left: `${bbox.x * 100}%`,
                  top: `${bbox.y * 100}%`,
                  width: `${bbox.width * 100}%`,
                  height: `${bbox.height * 100}%`,
                }}
              />
            )}
          </div>
          <p className="text-xs text-white/40">click to expand</p>
        </button>
      )}

      {expandOpen && thumbImage && (
        <ImageExpandModal
          image={thumbImage}
          bbox={bbox}
          fieldLabel={fieldLabel}
          onClose={() => setExpandOpen(false)}
        />
      )}
    </div>
  );
}
