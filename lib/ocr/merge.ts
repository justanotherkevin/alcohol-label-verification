// Combines one OcrResult per application image (front/back/etc.) into a single
// result. Each field is resolved independently: if only one image has a value,
// use it; if multiple agree, use it with the higher confidence; if they
// disagree, prefer the higher-confidence value (falling back to the first
// image when no provider reports confidence) and record the conflict so the
// caller can surface it to a human reviewer instead of silently guessing.
import { BoundingBoxMap, ConfidenceMap, ExtractedLabelData, OcrResult } from "./types"

export type FieldConflictMap = Partial<Record<keyof ExtractedLabelData, { imageIndex: number; value: string }[]>>

export interface MergedOcrResult {
  data: ExtractedLabelData
  confidence: ConfidenceMap
  boundingBoxes: BoundingBoxMap
  conflicts: FieldConflictMap
  rawTexts: (string | undefined)[]
}

const FIELDS: (keyof ExtractedLabelData)[] = [
  "brandName",
  "classType",
  "abv",
  "netContents",
  "bottler",
  "countryOfOrigin",
  "governmentWarning",
]

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

type Candidate = {
  imageIndex: number
  value: string
  confidence?: number
}

// Merges per-image OcrResults, indexed to match app.images order.
export function mergeOcrResults(perImageResults: OcrResult[]): MergedOcrResult {
  const data = {} as ExtractedLabelData
  const confidence: ConfidenceMap = {}
  const boundingBoxes: BoundingBoxMap = {}
  const conflicts: FieldConflictMap = {}

  for (const field of FIELDS) {
    const candidates: Candidate[] = []
    perImageResults.forEach((r, imageIndex) => {
      const value = r.data[field]
      if (value !== null && value !== undefined) {
        candidates.push({ imageIndex, value, confidence: r.confidence[field] })
      }
    })

    if (candidates.length === 0) {
      data[field] = null
      boundingBoxes[field] = null
      continue
    }

    const distinctValues = new Set(candidates.map((c) => normalize(c.value)))
    // Tesseract/Google Vision report no per-field confidence, so ties (including
    // "both undefined") fall through to the first candidate — i.e. images[0] wins
    // by convention, not because it was judged more confident.
    const best = candidates.reduce((a, b) => ((b.confidence ?? -1) > (a.confidence ?? -1) ? b : a))

    data[field] = best.value
    if (best.confidence !== undefined) confidence[field] = best.confidence
    const bbox = perImageResults[best.imageIndex].boundingBoxes?.[field]
    boundingBoxes[field] = bbox ? { ...bbox, imageIndex: best.imageIndex } : null

    if (distinctValues.size > 1) {
      conflicts[field] = candidates.map((c) => ({ imageIndex: c.imageIndex, value: c.value }))
    }
  }

  return {
    data,
    confidence,
    boundingBoxes,
    conflicts,
    rawTexts: perImageResults.map((r) => r.rawText),
  }
}
