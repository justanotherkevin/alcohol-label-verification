import { REQUIRED_GOVERNMENT_WARNING } from "@/lib/verify"
import { QueueApplication } from "./types"
import { loadMockImage } from "./load-image"

export type MockTemplate = Omit<QueueApplication, "id" | "submittedAt" | "status" | "analysis" | "resolution">

export const MOCK_QUEUE_TEMPLATES: MockTemplate[] = [
  {
    brandName: "Blue Ridge Bourbon",
    applicant: "Blue Ridge Distillers LLC",
    applicationData: {
      brandName: "BLUE RIDGE BOURBON",
      classType: "Straight Bourbon Whiskey",
      abv: "50% ABV",
      netContents: "750 mL",
      bottler: "Blue Ridge Distillers, Asheville, NC",
      countryOfOrigin: "USA",
      governmentWarning: REQUIRED_GOVERNMENT_WARNING,
    },
    ...loadMockImage("labels/label-3-front.png"),
  },
  {
    brandName: "Cascade Mountain Gin",
    applicant: "Cascade Spirits Co.",
    applicationData: {
      brandName: "CASCADE MOUNTAIN GIN",
      classType: "Gin",
      abv: "47% ABV",
      netContents: "750 mL",
      bottler: "Cascade Spirits Co., Bend, OR",
      countryOfOrigin: "USA",
      governmentWarning: REQUIRED_GOVERNMENT_WARNING,
    },
    ...loadMockImage("labels/label-1-back.png"),
  },
]
