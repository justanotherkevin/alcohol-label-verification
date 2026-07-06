export interface ExtractedLabelData {
  brandName: string | null
  classType: string | null
  abv: string | null
  netContents: string | null
  bottler: string | null
  countryOfOrigin: string | null
  governmentWarning: string | null
}

export type ConfidenceMap = Partial<Record<keyof ExtractedLabelData, number>>

export interface BoundingBox {
  imageIndex: number  // index into QueueApplication.images[]
  x: number           // 0.0–1.0, normalized fraction of image width
  y: number           // 0.0–1.0, normalized fraction of image height
  width: number       // 0.0–1.0
  height: number      // 0.0–1.0
  confidence?: number // 0.0–1.0, OCR confidence for this field extraction
}

// A field may resolve to several disconnected boxes (e.g. scattered-word
// fallback matching) rather than a single contiguous region. Empty array means
// no location could be found.
export type BoundingBoxMap = Partial<Record<keyof ExtractedLabelData, BoundingBox[]>>

export interface OcrResult {
  data: ExtractedLabelData
  confidence: ConfidenceMap
  boundingBoxes?: BoundingBoxMap
  rawText?: string
}

export interface GuidedSearchHints {
  brandName?: string | null
  classType?: string | null
  abv?: string | null
  netContents?: string | null
  bottler?: string | null
  countryOfOrigin?: string | null
  governmentWarning?: string | null
}

export interface OcrProvider {
  name: string
  extract: (imageBase64: string, mimeType: string, hints?: GuidedSearchHints) => Promise<OcrResult>
}
