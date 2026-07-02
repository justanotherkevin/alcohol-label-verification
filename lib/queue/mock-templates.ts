import { REQUIRED_GOVERNMENT_WARNING } from "@/lib/verify"
import { QueueApplication } from "./types"
import { loadMockImage } from "./load-image"

export type MockTemplate = Omit<QueueApplication, "id" | "submittedAt" | "status" | "ocrData" | "reviewData">

export const MOCK_QUEUE_TEMPLATES: MockTemplate[] = [
  {
    applicant: "Desert Luna Spirits",
    applicationData: {
      brandName: "DESERT LUNA & AGAVE",
      classType: "Premium Single Estate Agave Spirit",
      abv: "40% ABV",
      netContents: "750 mL",
      bottler: "Desert Luna Spirits, Oaxaca, MX",
      countryOfOrigin: "Mexico",
      governmentWarning: REQUIRED_GOVERNMENT_WARNING,
    },
    images: [loadMockImage("labels/label-3-front.png"), loadMockImage("labels/label-3-back.png")],
  },
  {
    applicant: "Desert Luna Spirits",
    applicationData: {
      brandName: "DESERT LUNA & AGAVE",
      classType: "Premium Botanical Spirit",
      abv: "40% ABV",
      netContents: "750 mL",
      bottler: "Desert Luna Spirits, Oaxaca, MX",
      countryOfOrigin: "Mexico",
      governmentWarning: REQUIRED_GOVERNMENT_WARNING,
    },
    images: [loadMockImage("labels/label-2-front.png"), loadMockImage("labels/label-2-back.png")],
  },
]
