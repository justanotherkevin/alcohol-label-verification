import { describe, it, expect } from "vitest"
import { extractFields } from "./extraction"

// Shared OCR text used by guided tests. Uses format variants to exercise fallback paths:
// - ABV written as "Alc./Vol." not "ABV"
// - Volume written as "750ml" not "750 mL"
const OCR_TEXT = [
  "DISTILLED AND BOTTLED BY:",
  "ABC DISTILLERY",
  "FREDERICK, MD",
  "ABC",
  "SINGLE BARREL",
  "STRAIGHT RYE WHISKY",
  "750ml",
  "45% Alc./Vol.",
  "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink",
  "alcoholic beverages during pregnancy because of the risk of birth defects.",
  "(2) Consumption of alcoholic beverages impairs your ability to drive a car or operate",
  "machinery, and may cause health problems.",
].join("\n")

// ---------------------------------------------------------------------------
// No hints → all fields null
// ---------------------------------------------------------------------------

describe("extractFields (no hints)", () => {
  it("returns all null when hints is undefined", () => {
    const result = extractFields(OCR_TEXT)
    expect(result.brandName).toBeNull()
    expect(result.classType).toBeNull()
    expect(result.abv).toBeNull()
    expect(result.netContents).toBeNull()
    expect(result.bottler).toBeNull()
    expect(result.countryOfOrigin).toBeNull()
    expect(result.governmentWarning).toBeNull()
  })

  it("returns all null when hints is an empty object", () => {
    const result = extractFields(OCR_TEXT, {})
    expect(Object.values(result).every((v) => v === null)).toBe(true)
  })

  it("returns null for fields whose hint is null", () => {
    const result = extractFields(OCR_TEXT, { brandName: null, abv: null })
    expect(result.brandName).toBeNull()
    expect(result.abv).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Brand name matching
// ---------------------------------------------------------------------------

describe("extractFields — brand name matching", () => {
  it("matches brand name found in OCR text", () => {
    const result = extractFields(OCR_TEXT, { brandName: "ABC DISTILLERY" })
    expect(result.brandName).toBe("ABC DISTILLERY")
  })

  it("matches brand name case-insensitively", () => {
    const result = extractFields(OCR_TEXT, { brandName: "abc distillery" })
    expect(result.brandName).toBe("abc distillery")
  })

  it("does not return the first OCR line when brand name appears later (ABC Distillery regression)", () => {
    // OCR_TEXT opens with "DISTILLED AND BOTTLED BY:" but brand is on the next line.
    // Old blind extractor picked the first line; hint-based matching must not.
    const result = extractFields(OCR_TEXT, { brandName: "ABC DISTILLERY" })
    expect(result.brandName).toBe("ABC DISTILLERY")
    expect(result.brandName).not.toBe("DISTILLED AND BOTTLED BY:")
  })

  it("returns null when brand name hint is not in OCR text", () => {
    const result = extractFields(OCR_TEXT, { brandName: "XYZ BRAND" })
    expect(result.brandName).toBeNull()
  })

  it("returns null when brand name hint is null", () => {
    expect(extractFields(OCR_TEXT, { brandName: null }).brandName).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Exact text matching (other fields)
// ---------------------------------------------------------------------------

describe("extractFields — exact match", () => {
  it("finds classType verbatim", () => {
    const result = extractFields(OCR_TEXT, { classType: "STRAIGHT RYE WHISKY" })
    expect(result.classType).toBe("STRAIGHT RYE WHISKY")
  })

  it("finds bottler verbatim (whitespace-normalized)", () => {
    const result = extractFields(OCR_TEXT, { bottler: "DISTILLED AND BOTTLED BY: ABC DISTILLERY" })
    // The text has a newline between them, which normalize() collapses
    expect(result.bottler).toBe("DISTILLED AND BOTTLED BY: ABC DISTILLERY")
  })

  it("returns null when bottler hint is not in OCR text", () => {
    const result = extractFields(OCR_TEXT, { bottler: "Old Tom Distillery, Louisville, KY" })
    expect(result.bottler).toBeNull()
  })

  it("finds countryOfOrigin", () => {
    const text = OCR_TEXT + "\nProduct of USA"
    const result = extractFields(text, { countryOfOrigin: "USA" })
    expect(result.countryOfOrigin).toBe("USA")
  })

  it("returns null when countryOfOrigin hint is absent", () => {
    const result = extractFields(OCR_TEXT, { countryOfOrigin: "Canada" })
    expect(result.countryOfOrigin).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// ABV format-variant fallback
// ---------------------------------------------------------------------------

describe("extractFields — ABV matching", () => {
  it("matches ABV when hint format matches OCR exactly", () => {
    const text = "HOLLOW CREEK\n35% ABV\n750 mL"
    const result = extractFields(text, { abv: "35% ABV" })
    expect(result.abv).toBe("35% ABV")
  })

  it("resolves ABV when hint says 'ABV' but label says 'Alc./Vol.'", () => {
    // OCR_TEXT has "45% Alc./Vol." — hint has "45% ABV"
    const result = extractFields(OCR_TEXT, { abv: "45% ABV" })
    expect(result.abv).toContain("45%")
    expect(result.abv).toContain("Alc")
  })

  it("resolves ABV when hint says 'ALC/VOL' but label says 'Alc./Vol.'", () => {
    const result = extractFields(OCR_TEXT, { abv: "45% ALC/VOL" })
    expect(result.abv).toContain("45%")
  })

  it("returns null when ABV number does not appear in OCR text at all", () => {
    const result = extractFields(OCR_TEXT, { abv: "99% ABV" })
    expect(result.abv).toBeNull()
  })

  it("returns null when ABV hint is null", () => {
    expect(extractFields(OCR_TEXT, { abv: null }).abv).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Net contents format-variant fallback
// ---------------------------------------------------------------------------

describe("extractFields — net contents matching", () => {
  it("matches net contents when hint format matches OCR exactly", () => {
    const text = "HOLLOW CREEK\n750 mL\n35% ABV"
    const result = extractFields(text, { netContents: "750 mL" })
    expect(result.netContents).toBe("750 mL")
  })

  it("resolves net contents when hint says '750 mL' but label says '750ml'", () => {
    // OCR_TEXT has "750ml"
    const result = extractFields(OCR_TEXT, { netContents: "750 mL" })
    expect(result.netContents).toContain("750")
  })

  it("resolves net contents when hint says '750 mL' but label says '750 ML'", () => {
    const text = OCR_TEXT.replace("750ml", "750 ML")
    const result = extractFields(text, { netContents: "750 mL" })
    expect(result.netContents).toContain("750")
  })

  it("returns null when volume number does not appear in OCR text", () => {
    const result = extractFields(OCR_TEXT, { netContents: "1.75 L" })
    expect(result.netContents).toBeNull()
  })

  it("returns null when netContents hint is null", () => {
    expect(extractFields(OCR_TEXT, { netContents: null }).netContents).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Government warning — whitespace-normalized match
// ---------------------------------------------------------------------------

describe("extractFields — government warning matching", () => {
  it("matches the full warning text even with OCR line breaks", () => {
    const hint =
      "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems."
    const result = extractFields(OCR_TEXT, { governmentWarning: hint })
    expect(result.governmentWarning).toBe(hint)
  })

  it("returns null when government warning hint is not in OCR text", () => {
    const result = extractFields(OCR_TEXT, { governmentWarning: "Some other warning" })
    expect(result.governmentWarning).toBeNull()
  })

  it("returns null when governmentWarning hint is null", () => {
    expect(extractFields(OCR_TEXT, { governmentWarning: null }).governmentWarning).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Full application hint object
// ---------------------------------------------------------------------------

describe("extractFields — full hints object", () => {
  it("resolves all fields when all hints are present and matchable", () => {
    const fullWarning =
      "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems."
    const result = extractFields(OCR_TEXT, {
      brandName: "ABC DISTILLERY",
      classType: "STRAIGHT RYE WHISKY",
      abv: "45% ABV",
      netContents: "750 mL",
      bottler: "DISTILLED AND BOTTLED BY: ABC DISTILLERY",
      countryOfOrigin: "FREDERICK",
      governmentWarning: fullWarning,
    })
    expect(result.brandName).toBe("ABC DISTILLERY")
    expect(result.classType).toBe("STRAIGHT RYE WHISKY")
    expect(result.abv).toContain("45%")
    expect(result.netContents).toContain("750")
    expect(result.bottler).toBe("DISTILLED AND BOTTLED BY: ABC DISTILLERY")
    expect(result.countryOfOrigin).toBe("FREDERICK")
    expect(result.governmentWarning).toBe(fullWarning)
  })

  it("returns null only for fields whose hint is missing from OCR text", () => {
    const result = extractFields(OCR_TEXT, {
      brandName: "ABC DISTILLERY",       // present
      classType: "UNKNOWN PRODUCT TYPE", // absent
    })
    expect(result.brandName).toBe("ABC DISTILLERY")
    expect(result.classType).toBeNull()
  })
})
