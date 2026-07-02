import { describe, it, expect } from "vitest"
import { validateResolution } from "./resolve"
import { OcrData } from "./types"

const analysis: OcrData = {
  extracted: {
    brandName: "X",
    classType: null,
    abv: null,
    netContents: null,
    bottler: null,
    countryOfOrigin: null,
    governmentWarning: null,
  },
  confidence: {},
  result: {
    overallPass: false,
    fields: [
      { field: "brandName", label: "Brand Name", expected: "X", extracted: "X", status: "pass" },
      { field: "abv", label: "Alcohol Content (ABV)", expected: "40%", extracted: "45%", status: "fail" },
    ],
  },
  analyzedAt: new Date().toISOString(),
}

describe("validateResolution", () => {
  it("rejects approval when a field is still flagged", () => {
    const outcome = validateResolution(analysis, { decision: "approved", overrides: [], rejectedFields: [], note: "" })
    expect(outcome.ok).toBe(false)
  })

  it("allows approval once the flagged field is overridden", () => {
    const outcome = validateResolution(analysis, {
      decision: "approved",
      overrides: [{ field: "abv", reason: "Confirmed via lab certificate" }],
      rejectedFields: [],
      note: "",
    })
    expect(outcome.ok).toBe(true)
  })

  it("rejects a reject-decision with no cited field", () => {
    const outcome = validateResolution(analysis, { decision: "rejected", overrides: [], rejectedFields: [], note: "bad label" })
    expect(outcome.ok).toBe(false)
  })

  it("rejects a reject-decision with no note", () => {
    const outcome = validateResolution(analysis, { decision: "rejected", overrides: [], rejectedFields: ["abv"], note: "" })
    expect(outcome.ok).toBe(false)
  })

  it("allows a reject-decision citing a flagged field with a note", () => {
    const outcome = validateResolution(analysis, {
      decision: "rejected",
      overrides: [],
      rejectedFields: ["abv"],
      note: "ABV mismatch, no certificate on file",
    })
    expect(outcome.ok).toBe(true)
  })

  it("rejects citing a field that was already overridden (no longer flagged)", () => {
    const outcome = validateResolution(analysis, {
      decision: "rejected",
      overrides: [{ field: "abv", reason: "ok" }],
      rejectedFields: ["abv"],
      note: "bad",
    })
    expect(outcome.ok).toBe(false)
  })

  it("rejects approval when a field passes text match but fails its regulatory check", () => {
    const regulatoryAnalysis: OcrData = {
      ...analysis,
      result: {
        overallPass: true,
        fields: [
          { field: "brandName", label: "Brand Name", expected: "X", extracted: "X", status: "pass" },
          {
            field: "abv",
            label: "Alcohol Content (ABV)",
            expected: "40%",
            extracted: "40%",
            status: "pass",
            regulatory: { status: "fail", note: "ABV outside legal range for this class/type" },
          },
        ],
      },
    }

    const outcome = validateResolution(regulatoryAnalysis, {
      decision: "approved",
      overrides: [],
      rejectedFields: [],
      note: "",
    })
    expect(outcome.ok).toBe(false)

    const outcomeAfterOverride = validateResolution(regulatoryAnalysis, {
      decision: "approved",
      overrides: [{ field: "abv", reason: "Confirmed via lab certificate" }],
      rejectedFields: [],
      note: "",
    })
    expect(outcomeAfterOverride.ok).toBe(true)
  })
})
