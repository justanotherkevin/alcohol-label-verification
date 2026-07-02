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

export type BoundingBoxMap = Partial<Record<keyof ExtractedLabelData, BoundingBox | null>>

export interface OcrResult {
  data: ExtractedLabelData
  confidence: ConfidenceMap
  boundingBoxes?: BoundingBoxMap
  rawText?: string
}

export interface OcrProvider {
  name: string
  extract: (imageBase64: string, mimeType: string) => Promise<OcrResult>
}
