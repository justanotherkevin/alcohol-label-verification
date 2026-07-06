"use client";

import { BoundingBox } from "@/lib/ocr/types";

interface LabelImage {
  path: string;
  mimeType: string;
  side?: string;
}

interface ImageExpandModalProps {
  image: LabelImage;
  boxes: BoundingBox[];
  fieldLabel: string;
  onClose: () => void;
}

export function ImageExpandModal({ image, boxes, fieldLabel, onClose }: ImageExpandModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-8"
      onClick={onClose}>
      <div
        className="relative max-w-2xl max-h-full"
        onClick={(e) => e.stopPropagation()}>
        <img src={image.path} alt={image.side ?? "Label"} className="max-h-[80vh] rounded-lg" />
        {boxes.map((bbox, idx) => (
          <div
            key={idx}
            className="absolute border-2 border-orange-400"
            style={{
              left: `${bbox.x * 100}%`,
              top: `${bbox.y * 100}%`,
              width: `${bbox.width * 100}%`,
              height: `${bbox.height * 100}%`,
            }}
          />
        ))}
        <button
          onClick={onClose}
          className="cursor-pointer absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white text-black font-bold shadow-lg">
          ×
        </button>
        <p className="text-center text-sm text-white/70 mt-2">{fieldLabel}</p>
      </div>
    </div>
  );
}
