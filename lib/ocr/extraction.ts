// Shared Layer 2 field-matching for all text-based OCR providers (Tesseract, Google Vision).
//
// Philosophy: OCR is a *matching* layer, not a blind extraction layer.
// A hint from the application's submitted data is required for a field to return
// a value — without one the field is null. Tolerance is applied only for known
// interchangeable formats (ABV notation variants, volume unit casing).

import { BoundingBox, BoundingBoxMap, ExtractedLabelData, GuidedSearchHints } from "./types"

export type WordLike = {
  text: string
  bbox: { x0: number; y0: number; x1: number; y1: number }
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim()
}

// Returns the hint verbatim if found in OCR text (case-insensitive, whitespace-normalized).
function matchExact(text: string, hint: string | null | undefined): string | null {
  if (!hint) return null
  return normalize(text).includes(normalize(hint)) ? hint : null
}

// ABV: exact match first, then numeric format-variant fallback.
// "45% ABV" matches "45% ALC/VOL.", "45% Alc./Vol.", etc.
function matchAbv(text: string, hint: string | null | undefined): string | null {
  if (!hint) return null
  if (matchExact(text, hint)) return hint
  const num = hint.match(/(\d+(?:\.\d+)?)/)?.[1]
  if (!num) return null
  const m = text.match(
    new RegExp(`${num}\\s*%\\s*(?:Alc\\.?\\/Vol\\.?|ALC\\/VOL\\.?|ABV|alcohol by volume)`, "i"),
  )
  return m ? m[0].trim() : null
}

// Net contents: exact match first, then numeric+unit variant fallback.
// "750 mL" matches "750ml", "750 ML", "750 Ml", etc.
function matchNetContents(text: string, hint: string | null | undefined): string | null {
  if (!hint) return null
  if (matchExact(text, hint)) return hint
  const num = hint.match(/(\d+(?:\.\d+)?)/)?.[1]
  if (!num) return null
  const m = text.match(new RegExp(`${num}\\s*(?:mL|ml|ML|L\\b|fl\\.?\\s*oz|oz)`, "i"))
  return m ? m[0].trim() : null
}

// Government warning: normalize both sides to absorb OCR line-break fragmentation.
function matchGovernmentWarning(text: string, hint: string | null | undefined): string | null {
  if (!hint) return null
  return normalize(text).includes(normalize(hint)) ? hint : null
}

// Main entry point called by every text-based OCR provider.
// All fields require a hint; unset or null hints produce null output.
export function extractFields(text: string, hints?: GuidedSearchHints): ExtractedLabelData {
  return {
    brandName: matchExact(text, hints?.brandName),
    classType: matchExact(text, hints?.classType),
    abv: matchAbv(text, hints?.abv),
    netContents: matchNetContents(text, hints?.netContents),
    bottler: matchExact(text, hints?.bottler),
    countryOfOrigin: matchExact(text, hints?.countryOfOrigin),
    governmentWarning: matchGovernmentWarning(text, hints?.governmentWarning),
  }
}

// Computes the union bounding box of OCR words that match the field value.
// Returns normalized 0–1 coordinates relative to image dimensions.
export function computeFieldBbox(
  words: WordLike[],
  fieldValue: string | null,
  W: number,
  H: number,
  imageIndex = 0,
): BoundingBox | null {
  if (!fieldValue || words.length === 0 || W === 0 || H === 0) return null
  const tokens = fieldValue.toLowerCase().split(/\s+/).filter((t) => t.length > 1)
  if (tokens.length === 0) return null
  const matched = words.filter((w) => {
    const wordText = w.text.toLowerCase()
    return wordText.length > 1 && tokens.some((t) => wordText.includes(t) || t.includes(wordText))
  })
  if (matched.length === 0) return null
  const x0 = Math.min(...matched.map((w) => w.bbox.x0))
  const y0 = Math.min(...matched.map((w) => w.bbox.y0))
  const x1 = Math.max(...matched.map((w) => w.bbox.x1))
  const y1 = Math.max(...matched.map((w) => w.bbox.y1))
  return { imageIndex, x: x0 / W, y: y0 / H, width: (x1 - x0) / W, height: (y1 - y0) / H }
}
