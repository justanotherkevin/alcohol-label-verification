import { describe, it, expect } from "vitest"
import { verifyLabel, REQUIRED_GOVERNMENT_WARNING, ApplicationData } from "./verify"

const baseApp: ApplicationData = {
  brandName: "Old Tom Distillery",
  classType: "Straight Bourbon Whiskey",
  abv: "45% ABV",
  netContents: "750 mL",
  bottler: "Old Tom Distillery, Louisville, KY",
  countryOfOrigin: "USA",
  governmentWarning: REQUIRED_GOVERNMENT_WARNING,
}

const baseExtracted = {
  brandName: "OLD TOM DISTILLERY",
  classType: "Straight Bourbon Whiskey",
  abv: "45% Alc./Vol.",
  netContents: "750 mL",
  bottler: "Old Tom Distillery, Louisville, KY",
  countryOfOrigin: "USA",
  governmentWarning: REQUIRED_GOVERNMENT_WARNING,
}

describe("verifyLabel — Layer 1 fuzzy matching", () => {
  it("passes when all fields match (case-insensitive)", () => {
    const result = verifyLabel(baseApp, baseExtracted)
    expect(result.overallPass).toBe(true)
  })

  it("fails on brand name mismatch", () => {
    const result = verifyLabel(baseApp, { ...baseExtracted, brandName: "Different Brand" })
    const field = result.fields.find((f) => f.field === "brandName")
    expect(field?.status).toBe("fail")
    expect(result.overallPass).toBe(false)
  })

  it("marks field as missing when extracted is null", () => {
    const result = verifyLabel(baseApp, { ...baseExtracted, abv: null })
    const field = result.fields.find((f) => f.field === "abv")
    expect(field?.status).toBe("missing")
  })

  it("fails government warning with title case prefix", () => {
    const result = verifyLabel(baseApp, {
      ...baseExtracted,
      governmentWarning:
        "Government Warning: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.",
    })
    const field = result.fields.find((f) => f.field === "governmentWarning")
    expect(field?.status).toBe("fail")
    expect(field?.note).toContain("GOVERNMENT WARNING:")
  })
})

describe("verifyLabel — Layer 2 regulatory", () => {
  it("flags invalid class type", () => {
    const result = verifyLabel(baseApp, { ...baseExtracted, classType: "Mystery Drink" })
    const field = result.fields.find((f) => f.field === "classType")
    expect(field?.regulatory?.status).toBe("fail")
  })

  it("flags ABV out of bounds for spirits", () => {
    const result = verifyLabel(
      { ...baseApp, abv: "10% ABV" },
      { ...baseExtracted, abv: "10% ABV" }
    )
    const field = result.fields.find((f) => f.field === "abv")
    expect(field?.regulatory?.status).toBe("fail")
  })

  it("flags non-standard fill size for spirits", () => {
    const result = verifyLabel(
      { ...baseApp, netContents: "800 mL" },
      { ...baseExtracted, netContents: "800 mL" }
    )
    const field = result.fields.find((f) => f.field === "netContents")
    expect(field?.regulatory?.status).toBe("fail")
  })

  it("includes confidence when provided", () => {
    const result = verifyLabel(baseApp, baseExtracted, { brandName: 0.95 })
    const field = result.fields.find((f) => f.field === "brandName")
    expect(field?.confidence).toBe(0.95)
  })
})
