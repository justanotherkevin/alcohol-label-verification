import { describe, it, expect, vi, afterEach } from "vitest"
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
  images: [{ path: "/demo-labels/hollow-creek.jpg", mimeType: "image/jpeg" }],
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

describe("analyzeApplication with a remote (uploaded) image URL", () => {
  const fetchSpy = vi.spyOn(global, "fetch")

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  it("fetches the image over HTTP instead of reading it off local disk", async () => {
    fetchSpy.mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), { status: 200 }) as unknown as Response
    )
    const appWithUploadedPhoto: QueueApplication = {
      ...baseApp,
      images: [
        { path: "https://example.public.blob.vercel-storage.com/label-abc123.jpg", mimeType: "image/jpeg" },
      ],
    }
    const { ocrData } = await analyzeApplication(appWithUploadedPhoto, "mock")
    expect(fetchSpy).toHaveBeenCalledWith("https://example.public.blob.vercel-storage.com/label-abc123.jpg")
    expect(ocrData.result.fields).toHaveLength(7)
  })

  it("throws a clear error when the remote fetch fails", async () => {
    fetchSpy.mockResolvedValue(new Response(null, { status: 404, statusText: "Not Found" }) as unknown as Response)
    const appWithUploadedPhoto: QueueApplication = {
      ...baseApp,
      images: [{ path: "https://example.public.blob.vercel-storage.com/missing.jpg", mimeType: "image/jpeg" }],
    }
    await expect(analyzeApplication(appWithUploadedPhoto, "mock")).rejects.toThrow(/404/)
  })
})
