import { describe, it, expect } from "vitest"
import { analyzeApplication } from "./analyze"
import { QueueApplication } from "./types"
import { REQUIRED_GOVERNMENT_WARNING } from "@/lib/verify"

const baseApp: QueueApplication = {
  id: "TEST-1",
  applicant: "Test Applicant",
  submittedAt: new Date().toISOString(),
  applicationData: {
    brandName: "OLD TOM DISTILLERY",
    classType: "Kentucky Straight Bourbon Whiskey",
    abv: "40% ABV",
    netContents: "750 mL",
    bottler: "Old Tom Distillery, Louisville, KY",
    countryOfOrigin: "USA",
    governmentWarning: REQUIRED_GOVERNMENT_WARNING,
  },
  images: [{ base64: "", mimeType: "image/png" }],
  status: "pending",
  ocrData: null,
  reviewData: { sessions: [], fieldNotes: [], resolution: null },
}

describe("analyzeApplication", () => {
  it("produces a VerificationResult with all 7 fields via the mock provider", async () => {
    const { ocrData } = await analyzeApplication(baseApp, "mock")
    expect(ocrData.result.fields).toHaveLength(7)
    expect(ocrData.analyzedAt).toBeTruthy()
  })

  it("fails government warning against the mock provider's title-case text", async () => {
    const { ocrData } = await analyzeApplication(baseApp, "mock")
    const govField = ocrData.result.fields.find((f) => f.field === "governmentWarning")
    expect(govField?.status).toBe("fail")
  })
})
