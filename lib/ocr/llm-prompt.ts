import { BoundingBox, BoundingBoxMap, ExtractedLabelData, OcrResult } from "./types"

export const EXTRACTION_SYSTEM_PROMPT = `You are an OCR specialist for TTB (Alcohol and Tobacco Tax and Trade Bureau) label verification.
Extract the following fields from the alcohol label image. Return ONLY valid JSON with exactly this structure:
{
  "brandName": { "value": string | null, "confidence": number, "boundingBox": { "x": number, "y": number, "width": number, "height": number } | null },
  "classType": { "value": string | null, "confidence": number, "boundingBox": { "x": number, "y": number, "width": number, "height": number } | null },
  "abv": { "value": string | null, "confidence": number, "boundingBox": { "x": number, "y": number, "width": number, "height": number } | null },
  "netContents": { "value": string | null, "confidence": number, "boundingBox": { "x": number, "y": number, "width": number, "height": number } | null },
  "bottler": { "value": string | null, "confidence": number, "boundingBox": { "x": number, "y": number, "width": number, "height": number } | null },
  "countryOfOrigin": { "value": string | null, "confidence": number, "boundingBox": { "x": number, "y": number, "width": number, "height": number } | null },
  "governmentWarning": { "value": string | null, "confidence": number, "boundingBox": { "x": number, "y": number, "width": number, "height": number } | null }
}
confidence is 0.0-1.0. Use null when a field is not present on the label.
boundingBox coordinates are normalized 0.0-1.0 fractions of image width/height. Use null if you cannot locate the field spatially.
For governmentWarning, extract the COMPLETE text exactly as printed, preserving capitalization.`

type FieldEntry = { value: string | null; confidence?: number; boundingBox?: BoundingBox | null }
type RawResponse = Partial<Record<keyof ExtractedLabelData, FieldEntry>>

export function parseExtractionResponse(json: string): OcrResult {
  const raw: RawResponse = JSON.parse(json)
  const fields: (keyof ExtractedLabelData)[] = [
    "brandName",
    "classType",
    "abv",
    "netContents",
    "bottler",
    "countryOfOrigin",
    "governmentWarning",
  ]
  const data: Partial<ExtractedLabelData> = {}
  const confidence: Partial<Record<keyof ExtractedLabelData, number>> = {}
  const boundingBoxes: BoundingBoxMap = {}

  for (const field of fields) {
    const entry = raw[field]
    data[field] = entry?.value ?? null
    if (typeof entry?.confidence === "number") {
      confidence[field] = entry.confidence
    }
    boundingBoxes[field] = entry?.boundingBox ? [entry.boundingBox] : []
  }

  return { data: data as ExtractedLabelData, confidence, boundingBoxes }
}

export function stripCodeFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/m, "").replace(/```\s*$/m, "").trim()
}
