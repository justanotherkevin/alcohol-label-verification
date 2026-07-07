import { describe, it, expect } from "vitest"
import { classifyAnalyzedRow } from "./runner"
import { OcrData } from "@/lib/queue/types"
import { FieldResult } from "@/lib/verify"

function ocrDataWithFields(fields: Partial<FieldResult>[]): OcrData {
  return {
    extracted: {
      brandName: null,
      classType: null,
      abv: null,
      netContents: null,
      bottler: null,
      countryOfOrigin: null,
      governmentWarning: null,
    },
    confidence: {},
    result: {
      fields: fields as FieldResult[],
      overallPass: fields.every((f) => f.status === "pass"),
    },
    analyzedAt: new Date().toISOString(),
  }
}

describe("classifyAnalyzedRow", () => {
  it("classifies a row with all passing fields as clean", () => {
    const ocrData = ocrDataWithFields([
      { field: "brandName", status: "pass" },
      { field: "abv", status: "pass" },
    ])
    expect(classifyAnalyzedRow(ocrData)).toBe("clean")
  })

  it("classifies a row with a failing field as flagged", () => {
    const ocrData = ocrDataWithFields([
      { field: "brandName", status: "pass" },
      { field: "governmentWarning", status: "fail" },
    ])
    expect(classifyAnalyzedRow(ocrData)).toBe("flagged")
  })

  it("classifies a row that text-matches but fails regulatory bounds as flagged", () => {
    const ocrData = ocrDataWithFields([
      { field: "abv", status: "pass", regulatory: { status: "fail", note: "out of bounds" } },
    ])
    expect(classifyAnalyzedRow(ocrData)).toBe("flagged")
  })
})
