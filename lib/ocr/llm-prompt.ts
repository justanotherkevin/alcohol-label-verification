import { ExtractedLabelData, OcrResult } from "./types"

export const EXTRACTION_SYSTEM_PROMPT = `You are an OCR specialist for TTB (Alcohol and Tobacco Tax and Trade Bureau) label verification.
Extract the following fields from the alcohol label image. Return ONLY valid JSON with exactly this structure:
{
  "brandName": { "value": string | null, "confidence": number },
  "classType": { "value": string | null, "confidence": number },
  "abv": { "value": string | null, "confidence": number },
  "netContents": { "value": string | null, "confidence": number },
  "bottler": { "value": string | null, "confidence": number },
  "countryOfOrigin": { "value": string | null, "confidence": number },
  "governmentWarning": { "value": string | null, "confidence": number }
}
confidence is 0.0-1.0. Use null when a field is not present on the label.
For governmentWarning, extract the COMPLETE text exactly as printed, preserving capitalization.`

type FieldEntry = { value: string | null; confidence?: number }
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

  for (const field of fields) {
    const entry = raw[field]
    data[field] = entry?.value ?? null
    if (typeof entry?.confidence === "number") {
      confidence[field] = entry.confidence
    }
  }

  return { data: data as ExtractedLabelData, confidence }
}

export function stripCodeFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/m, "").replace(/```\s*$/m, "").trim()
}
