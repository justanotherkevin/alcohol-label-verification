import { ExtractedLabelData, ConfidenceMap } from "./ocr/types"
import { FieldConflictMap } from "./ocr/merge"
import {
  isValidClassType,
  detectProductType,
  parseAbv,
  parseNetContentsMl,
  isValidFillSize,
  ABV_BOUNDS,
} from "./ttb-rules"

export interface ApplicationData {
  brandName: string
  classType: string
  abv: string
  netContents: string
  bottler: string
  countryOfOrigin: string
  governmentWarning: string
}

export interface RegulatoryCheck {
  status: "pass" | "fail" | "warning" | "skipped"
  note: string
}

export type FieldStatus = "pass" | "fail" | "missing"

export interface FieldResult {
  field: string
  label: string
  expected: string | null
  extracted: string | null
  status: FieldStatus
  confidence?: number
  note?: string
  regulatory?: RegulatoryCheck
}

export interface VerificationResult {
  overallPass: boolean
  fields: FieldResult[]
}

export const REQUIRED_GOVERNMENT_WARNING =
  "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink " +
  "alcoholic beverages during pregnancy because of the risk of birth defects. " +
  "(2) Consumption of alcoholic beverages impairs your ability to drive a car or " +
  "operate machinery, and may cause health problems."

function normalize(value: string | null): string {
  if (!value) return ""
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

function fuzzyMatch(expected: string | null, extracted: string | null): boolean {
  return normalize(expected) === normalize(extracted)
}

function abvMatch(expected: string | null, extracted: string | null): boolean {
  if (fuzzyMatch(expected, extracted)) return true
  // Compare numeric ABV values so "45% ABV" matches "45% Alc./Vol." (27 CFR Part 5.37b allowable revision)
  const expNum = expected?.match(/(\d+(?:\.\d+)?)/)?.[1]
  const extNum = extracted?.match(/(\d+(?:\.\d+)?)/)?.[1]
  return expNum !== undefined && extNum !== undefined && parseFloat(expNum) === parseFloat(extNum)
}

function strictMatch(expected: string, extracted: string | null): boolean {
  if (!extracted) return false
  return extracted.trim() === expected.trim()
}

function checkClassTypeRegulatory(extracted: string | null): RegulatoryCheck {
  if (!extracted) return { status: "skipped", note: "No extracted value" }
  if (!isValidClassType(extracted)) {
    return {
      status: "fail",
      note: `"${extracted}" is not a recognized TTB class/type designation (27 CFR Parts 4, 5, 7)`,
    }
  }
  return { status: "pass", note: "Recognized TTB class/type designation" }
}

function checkAbvRegulatory(extracted: string | null, classType: string | null): RegulatoryCheck {
  if (!extracted) return { status: "skipped", note: "No extracted ABV" }
  const abv = parseAbv(extracted)
  if (abv === null) return { status: "warning", note: "Could not parse numeric ABV value" }
  if (!classType) return { status: "skipped", note: "No class type to determine ABV bounds" }
  const productType = detectProductType(classType)
  if (!productType) return { status: "skipped", note: "Unknown product type — cannot check ABV bounds" }
  const bounds = ABV_BOUNDS[productType]
  if (abv < bounds.min || abv > bounds.max) {
    return {
      status: "fail",
      note: `ABV ${abv}% is outside allowed range for ${productType} (${bounds.min}%–${bounds.max}%)`,
    }
  }
  return { status: "pass", note: `ABV ${abv}% is within allowed range for ${productType}` }
}

function checkNetContentsRegulatory(
  extracted: string | null,
  classType: string | null
): RegulatoryCheck {
  if (!extracted) return { status: "skipped", note: "No extracted net contents" }
  const ml = parseNetContentsMl(extracted)
  if (ml === null) return { status: "warning", note: "Could not parse net contents in mL" }
  if (!classType) return { status: "skipped", note: "No class type to determine fill standards" }
  const productType = detectProductType(classType)
  if (!productType) return { status: "skipped", note: "Unknown product type — cannot check fill standards" }
  if (!isValidFillSize(ml, productType)) {
    return {
      status: "fail",
      note: `${ml} mL is not a standard fill size for ${productType} (27 CFR ${productType === "spirits" ? "5.47a" : "4.72"})`,
    }
  }
  return { status: "pass", note: `${ml} mL is a valid standard fill size` }
}

function conflictNote(field: keyof ExtractedLabelData, conflicts: FieldConflictMap): string | undefined {
  const values = conflicts[field]
  if (!values || values.length < 2) return undefined
  const bySide = values.map((v) => `image ${v.imageIndex}='${v.value}'`).join(", ")
  return `Images disagree on this field: ${bySide} — verify manually.`
}

export function verifyLabel(
  appData: ApplicationData,
  extracted: ExtractedLabelData,
  confidence: ConfidenceMap = {},
  conflicts: FieldConflictMap = {}
): VerificationResult {
  const fields: FieldResult[] = []

  function addFuzzyField(
    field: keyof ExtractedLabelData,
    label: string,
    expected: string | null,
    regulatory?: RegulatoryCheck
  ) {
    const ext = extracted[field]
    const status: FieldStatus = !ext ? "missing" : fuzzyMatch(expected, ext) ? "pass" : "fail"
    fields.push({
      field,
      label,
      expected,
      extracted: ext,
      status,
      confidence: confidence[field],
      regulatory,
      note: conflictNote(field, conflicts),
    })
  }

  addFuzzyField("brandName", "Brand Name", appData.brandName)
  addFuzzyField("classType", "Class / Type", appData.classType, checkClassTypeRegulatory(extracted.classType))
  // ABV uses numeric comparison so "45% ABV" matches "45% Alc./Vol."
  const abvExt = extracted.abv
  const abvStatus: FieldStatus = !abvExt ? "missing" : abvMatch(appData.abv, abvExt) ? "pass" : "fail"
  fields.push({
    field: "abv",
    label: "Alcohol Content (ABV)",
    expected: appData.abv,
    extracted: abvExt,
    status: abvStatus,
    confidence: confidence.abv,
    regulatory: checkAbvRegulatory(extracted.abv, extracted.classType),
    note: conflictNote("abv", conflicts),
  })
  addFuzzyField(
    "netContents",
    "Net Contents",
    appData.netContents,
    checkNetContentsRegulatory(extracted.netContents, extracted.classType)
  )
  addFuzzyField("bottler", "Bottler / Producer", appData.bottler)
  addFuzzyField("countryOfOrigin", "Country of Origin", appData.countryOfOrigin)

  // Government Warning — strict match
  const govExt = extracted.governmentWarning
  const govPass = strictMatch(REQUIRED_GOVERNMENT_WARNING, govExt)
  const govStatus: FieldStatus = !govExt ? "missing" : govPass ? "pass" : "fail"
  let govNote: string | undefined = conflictNote("governmentWarning", conflicts)
  if (govStatus === "fail" && govExt && !govExt.startsWith("GOVERNMENT WARNING:")) {
    govNote = `Warning must begin with "GOVERNMENT WARNING:" in ALL CAPS (27 CFR Part 16)` + (govNote ? ` ${govNote}` : "")
  } else if (govStatus === "fail") {
    govNote = "Warning text does not match required exact wording (27 CFR Part 16)" + (govNote ? ` ${govNote}` : "")
  }
  fields.push({
    field: "governmentWarning",
    label: "Government Warning",
    expected: REQUIRED_GOVERNMENT_WARNING,
    extracted: govExt,
    status: govStatus,
    confidence: confidence.governmentWarning,
    note: govNote,
  })

  const overallPass = fields.every((f) => f.status === "pass")
  return { overallPass, fields }
}
