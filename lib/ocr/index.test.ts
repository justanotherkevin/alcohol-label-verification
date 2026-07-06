import { describe, it, expect } from "vitest"
import { getProvider } from "./index"

describe("getProvider", () => {
  it("returns tesseract provider by default", () => {
    const p = getProvider("tesseract")
    expect(p.name).toBe("tesseract")
  })

  it("returns mock provider for 'mock'", () => {
    const p = getProvider("mock")
    expect(p.name).toBe("mock")
  })

  it("falls back to tesseract for unknown name", () => {
    const p = getProvider("unknown-provider")
    expect(p.name).toBe("tesseract")
  })

  it("mock provider extract returns OcrResult shape", async () => {
    const p = getProvider("mock")
    const result = await p.extract("base64", "image/jpeg")
    expect(result).toHaveProperty("data")
    expect(result).toHaveProperty("confidence")
    expect(result.data).toHaveProperty("brandName")
  }, 5000)

  it("mock provider returns boundingBoxes for all fields", async () => {
    const p = getProvider("mock")
    const result = await p.extract("base64", "image/jpeg")
    expect(result.boundingBoxes).toBeDefined()
    const fields = ["brandName", "classType", "abv", "netContents", "bottler", "countryOfOrigin", "governmentWarning"]
    for (const field of fields) {
      const boxes = result.boundingBoxes![field as keyof typeof result.boundingBoxes]
      expect(boxes).toHaveLength(1)
      expect(boxes![0]).toHaveProperty("x")
      expect(boxes![0]).toHaveProperty("y")
      expect(boxes![0]).toHaveProperty("width")
      expect(boxes![0]).toHaveProperty("height")
    }
  }, 5000)
})
