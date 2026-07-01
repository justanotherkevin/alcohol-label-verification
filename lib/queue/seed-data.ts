import { ApplicationData, FieldResult, REQUIRED_GOVERNMENT_WARNING, RegulatoryCheck } from "@/lib/verify"
import { ExtractedLabelData } from "@/lib/ocr/types"
import { QueueApplication } from "./types"
import { loadMockImage } from "./load-image"

const TITLE_CASE_WARNING =
  "Government Warning: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems."

function field(
  key: string,
  label: string,
  expected: string | null,
  extracted: string | null,
  status: FieldResult["status"],
  extra: Partial<FieldResult> = {}
): FieldResult {
  return { field: key, label, expected, extracted, status, ...extra }
}

const REG_PASS_CLASS: RegulatoryCheck = { status: "pass", note: "Recognized TTB class/type designation" }
const regPassAbv = (pct: number, type: string): RegulatoryCheck => ({
  status: "pass",
  note: `ABV ${pct}% is within allowed range for ${type}`,
})
const regPassFill = (ml: number): RegulatoryCheck => ({
  status: "pass",
  note: `${ml} mL is a valid standard fill size`,
})

function seed(
  id: string,
  brandName: string,
  applicant: string,
  submittedAt: string,
  imageFile: string,
  applicationData: ApplicationData,
  extracted: ExtractedLabelData,
  fields: FieldResult[],
  confidence: Record<string, number> = {}
): QueueApplication {
  return {
    id,
    brandName,
    applicant,
    submittedAt,
    applicationData,
    ...loadMockImage(imageFile),
    status: "analyzed",
    analysis: {
      extracted,
      confidence,
      result: { overallPass: fields.every((f) => f.status === "pass"), fields },
      analyzedAt: submittedAt,
    },
    resolution: null,
  }
}

export const SEED_APPLICATIONS: QueueApplication[] = [
  // 1. Clean AI pass
  seed(
    "TTB-2026-1001",
    "Old Tom Distillery — Bourbon Reserve",
    "Old Tom Distillery LLC",
    "2026-06-29T14:00:00.000Z",
    "label_1.jpg",
    {
      brandName: "OLD TOM DISTILLERY",
      classType: "Kentucky Straight Bourbon Whiskey",
      abv: "45% ABV",
      netContents: "750 mL",
      bottler: "Old Tom Distillery, Louisville, KY",
      countryOfOrigin: "USA",
      governmentWarning: REQUIRED_GOVERNMENT_WARNING,
    },
    {
      brandName: "OLD TOM DISTILLERY",
      classType: "Kentucky Straight Bourbon Whiskey",
      abv: "45% Alc./Vol.",
      netContents: "750 mL",
      bottler: "Old Tom Distillery, Louisville, KY",
      countryOfOrigin: "USA",
      governmentWarning: REQUIRED_GOVERNMENT_WARNING,
    },
    [
      field("brandName", "Brand Name", "OLD TOM DISTILLERY", "OLD TOM DISTILLERY", "pass"),
      field("classType", "Class / Type", "Kentucky Straight Bourbon Whiskey", "Kentucky Straight Bourbon Whiskey", "pass", { regulatory: REG_PASS_CLASS }),
      field("abv", "Alcohol Content (ABV)", "45% ABV", "45% Alc./Vol.", "pass", { regulatory: regPassAbv(45, "spirits") }),
      field("netContents", "Net Contents", "750 mL", "750 mL", "pass", { regulatory: regPassFill(750) }),
      field("bottler", "Bottler / Producer", "Old Tom Distillery, Louisville, KY", "Old Tom Distillery, Louisville, KY", "pass"),
      field("countryOfOrigin", "Country of Origin", "USA", "USA", "pass"),
      field("governmentWarning", "Government Warning", REQUIRED_GOVERNMENT_WARNING, REQUIRED_GOVERNMENT_WARNING, "pass"),
    ]
  ),

  // 2. Government Warning strict-fail (title case)
  seed(
    "TTB-2026-1002",
    "ABC Distillery — Silver Label Vodka",
    "ABC Distillery Inc.",
    "2026-06-29T15:30:00.000Z",
    "abc-distillery.png",
    {
      brandName: "ABC Distillery",
      classType: "Vodka",
      abv: "40% ABV",
      netContents: "750 mL",
      bottler: "ABC Distillery, Austin, TX",
      countryOfOrigin: "USA",
      governmentWarning: REQUIRED_GOVERNMENT_WARNING,
    },
    {
      brandName: "ABC Distillery",
      classType: "Vodka",
      abv: "40% Alc./Vol.",
      netContents: "750 mL",
      bottler: "ABC Distillery, Austin, TX",
      countryOfOrigin: "USA",
      governmentWarning: TITLE_CASE_WARNING,
    },
    [
      field("brandName", "Brand Name", "ABC Distillery", "ABC Distillery", "pass"),
      field("classType", "Class / Type", "Vodka", "Vodka", "pass", { regulatory: REG_PASS_CLASS }),
      field("abv", "Alcohol Content (ABV)", "40% ABV", "40% Alc./Vol.", "pass", { regulatory: regPassAbv(40, "spirits") }),
      field("netContents", "Net Contents", "750 mL", "750 mL", "pass", { regulatory: regPassFill(750) }),
      field("bottler", "Bottler / Producer", "ABC Distillery, Austin, TX", "ABC Distillery, Austin, TX", "pass"),
      field("countryOfOrigin", "Country of Origin", "USA", "USA", "pass"),
      field("governmentWarning", "Government Warning", REQUIRED_GOVERNMENT_WARNING, TITLE_CASE_WARNING, "fail", {
        note: 'Warning must begin with "GOVERNMENT WARNING:" in ALL CAPS (27 CFR Part 16)',
      }),
    ]
  ),

  // 3. Fuzzy-match pass (case/punctuation diff on brand name — allowable revision)
  seed(
    "TTB-2026-1003",
    "Malt & Hop Brewery — Golden Ale",
    "Malt & Hop Brewing Co.",
    "2026-06-30T09:15:00.000Z",
    "malt-hop-brewery.png",
    {
      brandName: "MALT & HOP BREWERY",
      classType: "Ale",
      abv: "5.5% ABV",
      netContents: "12 FL OZ",
      bottler: "Malt & Hop Brewery, Portland, OR",
      countryOfOrigin: "USA",
      governmentWarning: REQUIRED_GOVERNMENT_WARNING,
    },
    {
      brandName: "Malt & Hop Brewery",
      classType: "Ale",
      abv: "5.5% Alc./Vol.",
      netContents: "12 FL OZ",
      bottler: "Malt & Hop Brewery, Portland, OR",
      countryOfOrigin: "USA",
      governmentWarning: REQUIRED_GOVERNMENT_WARNING,
    },
    [
      field("brandName", "Brand Name", "MALT & HOP BREWERY", "Malt & Hop Brewery", "pass"),
      field("classType", "Class / Type", "Ale", "Ale", "pass", { regulatory: REG_PASS_CLASS }),
      field("abv", "Alcohol Content (ABV)", "5.5% ABV", "5.5% Alc./Vol.", "pass", { regulatory: regPassAbv(5.5, "malt") }),
      field("netContents", "Net Contents", "12 FL OZ", "12 FL OZ", "pass"),
      field("bottler", "Bottler / Producer", "Malt & Hop Brewery, Portland, OR", "Malt & Hop Brewery, Portland, OR", "pass"),
      field("countryOfOrigin", "Country of Origin", "USA", "USA", "pass"),
      field("governmentWarning", "Government Warning", REQUIRED_GOVERNMENT_WARNING, REQUIRED_GOVERNMENT_WARNING, "pass"),
    ]
  ),

  // 4. Low-confidence / glare — country of origin misread
  seed(
    "TTB-2026-1004",
    "12345 Imports — Cabernet Sauvignon",
    "12345 Imports LLC",
    "2026-06-30T11:00:00.000Z",
    "12345-imports.png",
    {
      brandName: "12345 Imports",
      classType: "Cabernet Sauvignon",
      abv: "13.5% ABV",
      netContents: "750 mL",
      bottler: "12345 Imports, Miami, FL",
      countryOfOrigin: "Chile",
      governmentWarning: REQUIRED_GOVERNMENT_WARNING,
    },
    {
      brandName: "12345 Imports",
      classType: "Cabernet Sauvignon",
      abv: "13.5% Alc./Vol.",
      netContents: "750 mL",
      bottler: "12345 Imports, Miami, FL",
      countryOfOrigin: "Ch1le",
      governmentWarning: REQUIRED_GOVERNMENT_WARNING,
    },
    [
      field("brandName", "Brand Name", "12345 Imports", "12345 Imports", "pass"),
      field("classType", "Class / Type", "Cabernet Sauvignon", "Cabernet Sauvignon", "pass", { regulatory: REG_PASS_CLASS }),
      field("abv", "Alcohol Content (ABV)", "13.5% ABV", "13.5% Alc./Vol.", "pass", { regulatory: regPassAbv(13.5, "wine") }),
      field("netContents", "Net Contents", "750 mL", "750 mL", "pass", { regulatory: regPassFill(750) }),
      field("bottler", "Bottler / Producer", "12345 Imports, Miami, FL", "12345 Imports, Miami, FL", "pass"),
      field("countryOfOrigin", "Country of Origin", "Chile", "Ch1le", "fail", {
        confidence: 0.42,
        note: "Low-confidence extraction — possible glare on label. Review the original image before rejecting.",
      }),
      field("governmentWarning", "Government Warning", REQUIRED_GOVERNMENT_WARNING, REQUIRED_GOVERNMENT_WARNING, "pass"),
    ],
    { countryOfOrigin: 0.42 }
  ),

  // 5. Override-candidate — ABV mismatch
  seed(
    "TTB-2026-1005",
    "Cascade Peak Gin",
    "Cascade Peak Distillers",
    "2026-06-30T13:45:00.000Z",
    "labels/label-1-front.png",
    {
      brandName: "Cascade Peak Gin",
      classType: "Gin",
      abv: "45% ABV",
      netContents: "750 mL",
      bottler: "Cascade Peak Distillers, Bend, OR",
      countryOfOrigin: "USA",
      governmentWarning: REQUIRED_GOVERNMENT_WARNING,
    },
    {
      brandName: "Cascade Peak Gin",
      classType: "Gin",
      abv: "40% Alc./Vol.",
      netContents: "750 mL",
      bottler: "Cascade Peak Distillers, Bend, OR",
      countryOfOrigin: "USA",
      governmentWarning: REQUIRED_GOVERNMENT_WARNING,
    },
    [
      field("brandName", "Brand Name", "Cascade Peak Gin", "Cascade Peak Gin", "pass"),
      field("classType", "Class / Type", "Gin", "Gin", "pass", { regulatory: REG_PASS_CLASS }),
      field("abv", "Alcohol Content (ABV)", "45% ABV", "40% Alc./Vol.", "fail", {
        regulatory: regPassAbv(40, "spirits"),
        note: "Application claims 45% ABV; label reads 40% Alc./Vol. — confirm against the approved formula.",
      }),
      field("netContents", "Net Contents", "750 mL", "750 mL", "pass", { regulatory: regPassFill(750) }),
      field("bottler", "Bottler / Producer", "Cascade Peak Distillers, Bend, OR", "Cascade Peak Distillers, Bend, OR", "pass"),
      field("countryOfOrigin", "Country of Origin", "USA", "USA", "pass"),
      field("governmentWarning", "Government Warning", REQUIRED_GOVERNMENT_WARNING, REQUIRED_GOVERNMENT_WARNING, "pass"),
    ]
  ),
]

// 6. Pending — no analysis yet, demonstrates "Run pre-analysis now"
const pendingSeed: QueueApplication = {
  id: "TTB-2026-1006",
  brandName: "Sonoma Ridge Chardonnay",
  applicant: "Sonoma Ridge Winery",
  submittedAt: "2026-06-30T16:00:00.000Z",
  applicationData: {
    brandName: "Sonoma Ridge",
    classType: "Chardonnay",
    abv: "13% ABV",
    netContents: "750 mL",
    bottler: "Sonoma Ridge Winery, Sonoma, CA",
    countryOfOrigin: "USA",
    governmentWarning: REQUIRED_GOVERNMENT_WARNING,
  },
  ...loadMockImage("labels/label-2-front.png"),
  status: "pending",
  analysis: null,
  resolution: null,
}

SEED_APPLICATIONS.push(pendingSeed)
