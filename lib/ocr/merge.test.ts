import { describe, it, expect } from "vitest"
import { mergeOcrResults } from "./merge"
import { ExtractedLabelData, OcrResult } from "./types"

const emptyFields: ExtractedLabelData = {
  brandName: null,
  classType: null,
  abv: null,
  netContents: null,
  bottler: null,
  countryOfOrigin: null,
  governmentWarning: null,
}

function result(data: Partial<ExtractedLabelData>, extra: Partial<OcrResult> = {}): OcrResult {
  return { data: { ...emptyFields, ...data }, confidence: {}, ...extra }
}

describe("mergeOcrResults", () => {
  it("uses the only image that has a value for a field", () => {
    const front = result({ brandName: "HOLLOW CREEK" })
    const back = result({ governmentWarning: "GOVERNMENT WARNING: ..." })
    const merged = mergeOcrResults([front, back])
    expect(merged.data.brandName).toBe("HOLLOW CREEK")
    expect(merged.data.governmentWarning).toBe("GOVERNMENT WARNING: ...")
    expect(merged.conflicts.brandName).toBeUndefined()
    expect(merged.conflicts.governmentWarning).toBeUndefined()
  })

  it("does not flag a conflict when both images agree (case/whitespace-insensitive)", () => {
    const front = result({ brandName: "Hollow Creek" })
    const back = result({ brandName: "  hollow   creek  " })
    const merged = mergeOcrResults([front, back])
    expect(merged.data.brandName).toBe("Hollow Creek")
    expect(merged.conflicts.brandName).toBeUndefined()
  })

  it("prefers the higher-confidence value and records a conflict when images disagree", () => {
    const front = result({ abv: "43% ABV" }, { confidence: { abv: 0.6 } })
    const back = result({ abv: "45% ABV" }, { confidence: { abv: 0.9 } })
    const merged = mergeOcrResults([front, back])
    expect(merged.data.abv).toBe("45% ABV")
    expect(merged.confidence.abv).toBe(0.9)
    expect(merged.conflicts.abv).toEqual([
      { imageIndex: 0, value: "43% ABV" },
      { imageIndex: 1, value: "45% ABV" },
    ])
  })

  it("falls back to the first image when no confidence is reported and images disagree", () => {
    const front = result({ abv: "43% ABV" })
    const back = result({ abv: "45% ABV" })
    const merged = mergeOcrResults([front, back])
    expect(merged.data.abv).toBe("43% ABV")
    expect(merged.conflicts.abv).toHaveLength(2)
  })

  it("stamps the bounding boxes with the source image's index", () => {
    const front = result(
      { brandName: "HOLLOW CREEK" },
      { boundingBoxes: { brandName: [{ imageIndex: 0, x: 0, y: 0, width: 1, height: 1 }] } }
    )
    const back = result({})
    const merged = mergeOcrResults([front, back])
    expect(merged.boundingBoxes.brandName?.[0]?.imageIndex).toBe(0)
  })

  it("returns null data and no bounding boxes when no image has a value", () => {
    const merged = mergeOcrResults([result({}), result({})])
    expect(merged.data.brandName).toBeNull()
    expect(merged.boundingBoxes.brandName).toEqual([])
  })

  it("preserves rawText per image, indexed to match input order", () => {
    const front = result({}, { rawText: "front text" })
    const back = result({}, { rawText: "back text" })
    const merged = mergeOcrResults([front, back])
    expect(merged.rawTexts).toEqual(["front text", "back text"])
  })
})
