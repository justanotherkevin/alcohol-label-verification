import { describe, it, expect } from "vitest"
import { analyzeApplication } from "./analyze"
import { QueueApplication } from "./types"
import { REQUIRED_GOVERNMENT_WARNING } from "@/lib/verify"

const baseApp: QueueApplication = {
  id: "TEST-1",
  brandName: "Test Brand",
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
  analysis: null,
  resolution: null,
}

describe("analyzeApplication", () => {
  it("produces a VerificationResult with all 7 fields via the mock provider", async () => {
    const { analysis } = await analyzeApplication(baseApp, "mock")
    expect(analysis.result.fields).toHaveLength(7)
    expect(analysis.analyzedAt).toBeTruthy()
  })

  it("fails government warning against the mock provider's title-case text", async () => {
    const { analysis } = await analyzeApplication(baseApp, "mock")
    const govField = analysis.result.fields.find((f) => f.field === "governmentWarning")
    expect(govField?.status).toBe("fail")
  })
})
