import { ExtractedLabelData } from "./ocr/types"

export const REQUIRED_GOVERNMENT_WARNING =
  "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems."

export type FieldStatus = "pass" | "fail" | "missing"

export interface FieldResult {
  field: string
  label: string
  expected: string | null
  extracted: string | null
  status: FieldStatus
  note?: string
}

export interface VerificationResult {
  overallPass: boolean
  fields: FieldResult[]
}

export interface ApplicationData {
  brandName: string
  classType: string
  abv: string
  netContents: string
  bottler: string
  countryOfOrigin: string
  governmentWarning: string
}

function normalize(value: string | null): string {
  if (!value) return ""
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

function fuzzyMatch(expected: string | null, extracted: string | null): boolean {
  return normalize(expected) === normalize(extracted)
}

function strictMatch(expected: string, extracted: string | null): boolean {
  if (!extracted) return false
  return extracted.trim() === expected.trim()
}

function fieldResult(
  field: string,
  label: string,
  expected: string | null,
  extracted: string | null,
  match: boolean,
  note?: string
): FieldResult {
  const status: FieldStatus = !extracted ? "missing" : match ? "pass" : "fail"
  return { field, label, expected, extracted, status, note }
}

export function verifyLabel(
  appData: ApplicationData,
  extracted: ExtractedLabelData
): VerificationResult {
  const fields: FieldResult[] = [
    fieldResult(
      "brandName",
      "Brand Name",
      appData.brandName,
      extracted.brandName,
      fuzzyMatch(appData.brandName, extracted.brandName)
    ),
    fieldResult(
      "classType",
      "Class / Type",
      appData.classType,
      extracted.classType,
      fuzzyMatch(appData.classType, extracted.classType)
    ),
    fieldResult(
      "abv",
      "Alcohol Content (ABV)",
      appData.abv,
      extracted.abv,
      fuzzyMatch(appData.abv, extracted.abv)
    ),
    fieldResult(
      "netContents",
      "Net Contents",
      appData.netContents,
      extracted.netContents,
      fuzzyMatch(appData.netContents, extracted.netContents)
    ),
    fieldResult(
      "bottler",
      "Bottler / Producer",
      appData.bottler,
      extracted.bottler,
      fuzzyMatch(appData.bottler, extracted.bottler)
    ),
    fieldResult(
      "countryOfOrigin",
      "Country of Origin",
      appData.countryOfOrigin,
      extracted.countryOfOrigin,
      fuzzyMatch(appData.countryOfOrigin, extracted.countryOfOrigin)
    ),
    fieldResult(
      "governmentWarning",
      "Government Warning",
      REQUIRED_GOVERNMENT_WARNING,
      extracted.governmentWarning,
      // Strict match against the canonical required text, not the application data
      strictMatch(REQUIRED_GOVERNMENT_WARNING, extracted.governmentWarning),
      'Must match exact required text with "GOVERNMENT WARNING:" in ALL CAPS bold'
    ),
  ]

  const overallPass = fields.every((f) => f.status === "pass")
  return { overallPass, fields }
}
