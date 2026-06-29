export interface ExtractedLabelData {
  brandName: string | null
  classType: string | null
  abv: string | null
  netContents: string | null
  bottler: string | null
  countryOfOrigin: string | null
  governmentWarning: string | null
}

export interface OcrProvider {
  name: string
  extract: (imageBase64: string, mimeType: string) => Promise<ExtractedLabelData>
}
