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

export interface OcrResult {
  data: ExtractedLabelData
  confidence: ConfidenceMap
}

export interface OcrProvider {
  name: string
  extract: (imageBase64: string, mimeType: string) => Promise<OcrResult>
}
