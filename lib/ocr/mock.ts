import { OcrProvider, OcrResult } from "./types"

const MOCK_DELAY_MS = 800

const MOCK_EXTRACTED = {
  brandName: "OLD TOM DISTILLERY",
  classType: "Kentucky Straight Bourbon Whiskey",
  abv: "40% Alc./Vol. (80 Proof)",
  netContents: "750 mL",
  bottler: "Old Tom Distillery, Louisville, KY",
  countryOfOrigin: "USA",
  governmentWarning:
    "Government Warning: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.",
}

export const mockOcrProvider: OcrProvider = {
  name: "mock",
  async extract(_imageBase64: string, _mimeType: string): Promise<OcrResult> {
    await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY_MS))
    return { data: MOCK_EXTRACTED, confidence: {} }
  },
}
