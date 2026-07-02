import { BoundingBoxMap, ExtractedLabelData, OcrProvider, OcrResult } from "./types"

const MOCK_DELAY_MS = 800

const MOCK_EXTRACTED: ExtractedLabelData = {
  brandName: "OLD TOM DISTILLERY",
  classType: "Kentucky Straight Bourbon Whiskey",
  abv: "40% Alc./Vol. (80 Proof)",
  netContents: "750 mL",
  bottler: "Old Tom Distillery, Louisville, KY",
  countryOfOrigin: "USA",
  governmentWarning:
    "Government Warning: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.",
}

const MOCK_BOUNDING_BOXES: BoundingBoxMap = {
  brandName:         { imageIndex: 0, x: 0.10, y: 0.05, width: 0.80, height: 0.12 },
  classType:         { imageIndex: 0, x: 0.20, y: 0.20, width: 0.60, height: 0.08 },
  abv:               { imageIndex: 0, x: 0.30, y: 0.30, width: 0.40, height: 0.06 },
  netContents:       { imageIndex: 0, x: 0.30, y: 0.38, width: 0.40, height: 0.06 },
  bottler:           { imageIndex: 0, x: 0.10, y: 0.70, width: 0.80, height: 0.08 },
  countryOfOrigin:   { imageIndex: 0, x: 0.10, y: 0.80, width: 0.50, height: 0.06 },
  governmentWarning: { imageIndex: 0, x: 0.05, y: 0.85, width: 0.90, height: 0.10 },
}

export const mockOcrProvider: OcrProvider = {
  name: "mock",
  async extract(_imageBase64: string, _mimeType: string, _hints?: import("./types").GuidedSearchHints): Promise<OcrResult> {
    await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY_MS))
    return { data: MOCK_EXTRACTED, confidence: {}, boundingBoxes: MOCK_BOUNDING_BOXES }
  },
}
