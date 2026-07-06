import { describe, it, expect } from "vitest"
import { parseExtractionResponse } from "./llm-prompt"

const FULL_BBOX_JSON = JSON.stringify({
  brandName:         { value: "OLD TOM", confidence: 0.95, boundingBox: { x: 0.1, y: 0.05, width: 0.8, height: 0.1 } },
  classType:         { value: "Bourbon Whiskey", confidence: 0.9, boundingBox: { x: 0.2, y: 0.2, width: 0.6, height: 0.08 } },
  abv:               { value: "40% ABV", confidence: 0.85, boundingBox: null },
  netContents:       { value: "750 mL", confidence: 0.9, boundingBox: { x: 0.3, y: 0.35, width: 0.4, height: 0.06 } },
  bottler:           { value: null, confidence: 0, boundingBox: null },
  countryOfOrigin:   { value: "USA", confidence: 0.8, boundingBox: { x: 0.1, y: 0.75, width: 0.3, height: 0.05 } },
  governmentWarning: { value: "GOVERNMENT WARNING: ...", confidence: 0.99, boundingBox: { x: 0.05, y: 0.85, width: 0.9, height: 0.1 } },
})

const NO_BBOX_JSON = JSON.stringify({
  brandName:   { value: "TEST", confidence: 0.9 },
  classType:   { value: "Wine", confidence: 0.8 },
  abv:         { value: null, confidence: 0 },
  netContents: { value: "750 mL", confidence: 0.9 },
  bottler:     { value: null, confidence: 0 },
  countryOfOrigin:   { value: null, confidence: 0 },
  governmentWarning: { value: null, confidence: 0 },
})

describe("parseExtractionResponse — bounding boxes", () => {
  it("extracts boundingBoxes when present in response", () => {
    const result = parseExtractionResponse(FULL_BBOX_JSON)
    expect(result.boundingBoxes).toBeDefined()
    expect(result.boundingBoxes!.brandName).toEqual([{ x: 0.1, y: 0.05, width: 0.8, height: 0.1 }])
    expect(result.boundingBoxes!.netContents).toEqual([{ x: 0.3, y: 0.35, width: 0.4, height: 0.06 }])
    expect(result.boundingBoxes!.governmentWarning).toEqual([{ x: 0.05, y: 0.85, width: 0.9, height: 0.1 }])
  })

  it("returns an empty array when field returns null bbox", () => {
    const result = parseExtractionResponse(FULL_BBOX_JSON)
    expect(result.boundingBoxes!.abv).toEqual([])
    expect(result.boundingBoxes!.bottler).toEqual([])
  })

  it("returns all-empty boundingBoxes when response has no boundingBox fields", () => {
    const result = parseExtractionResponse(NO_BBOX_JSON)
    expect(result.boundingBoxes).toBeDefined()
    const vals = Object.values(result.boundingBoxes!)
    expect(vals.every(v => Array.isArray(v) && v.length === 0)).toBe(true)
  })

  it("still extracts data and confidence correctly when boundingBoxes present", () => {
    const result = parseExtractionResponse(FULL_BBOX_JSON)
    expect(result.data.brandName).toBe("OLD TOM")
    expect(result.confidence.brandName).toBe(0.95)
  })
})
