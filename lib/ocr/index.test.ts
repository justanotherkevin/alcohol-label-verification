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
})
