import { describe, it, expect } from "vitest"
import { extractFields, computeFieldBoxes, WordLike } from "./extraction"

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

  it("resolves ABV when the label spells out 'Alcohol/Volume' in full", () => {
    // demo-TTB-2026-1008 regression: the label reads "13.68% Alcohol/Volume",
    // not an abbreviated "Alc/Vol" or "ABV" — the old regex only recognized
    // the abbreviated forms and returned null even though the value is present.
    const text = "HAWK'S SHADOW\n13.68% Alcohol/Volume\n375 mL"
    const result = extractFields(text, { abv: "13.68 % ABV" })
    expect(result.abv).not.toBeNull()
    expect(result.abv).toContain("13.68%")
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

// ---------------------------------------------------------------------------
// computeFieldBbox — bounding rect from OCR word list
// ---------------------------------------------------------------------------

const W = 1000
const H = 500

function word(text: string, x0: number, y0: number, x1: number, y1: number): WordLike {
  return { text, bbox: { x0, y0, x1, y1 } }
}

describe("computeFieldBoxes — no-match cases", () => {
  it("returns no boxes when fieldValue is null", () => {
    const words = [word("ABC", 0, 0, 100, 20)]
    expect(computeFieldBoxes(words, null, W, H)).toEqual([])
  })

  it("returns no boxes when word list is empty", () => {
    expect(computeFieldBoxes([], "ABC DISTILLERY", W, H)).toEqual([])
  })

  it("returns no boxes when no words match the field value", () => {
    const words = [word("UNRELATED", 0, 0, 100, 20)]
    expect(computeFieldBoxes(words, "XYZ BRAND", W, H)).toEqual([])
  })

  it("does not match single-character OCR words (noise guard)", () => {
    // Single-char words like "l" (OCR artifact) should not match anything
    const words = [word("l", 0, 0, 5, 10), word("UNRELATED", 10, 0, 100, 20)]
    expect(computeFieldBoxes(words, "l vodka", W, H)).toEqual([])
  })
})

describe("computeFieldBoxes — basic matching", () => {
  it("returns a box when an OCR word contains a token from the field value", () => {
    const words = [word("ABC", 0, 0, 100, 20), word("DISTILLERY", 110, 0, 300, 20)]
    const boxes = computeFieldBoxes(words, "ABC DISTILLERY", W, H)
    expect(boxes).toHaveLength(1)
    expect(boxes[0].x).toBeCloseTo(0 / W)
    expect(boxes[0].width).toBeCloseTo(300 / W)
  })

  it("returns normalized coordinates in 0–1 range", () => {
    const words = [word("750ml", 200, 100, 350, 130)]
    const boxes = computeFieldBoxes(words, "750ml", W, H)
    expect(boxes).toHaveLength(1)
    expect(boxes[0].x).toBeGreaterThanOrEqual(0)
    expect(boxes[0].x).toBeLessThanOrEqual(1)
    expect(boxes[0].y).toBeGreaterThanOrEqual(0)
    expect(boxes[0].y).toBeLessThanOrEqual(1)
  })
})

describe("computeFieldBoxes — bidirectional token matching (ABV split-word case)", () => {
  it("matches when OCR splits 'Alc./Vol.' into separate words", () => {
    // matchAbv returns "45% Alc./Vol." as the extracted value.
    // OCR word segmentation splits it into three words.
    const words = [
      word("45%", 0, 0, 40, 20),
      word("Alc.", 45, 0, 80, 20),
      word("Vol.", 82, 0, 120, 20),
    ]
    const boxes = computeFieldBoxes(words, "45% Alc./Vol.", W, H)
    expect(boxes).toHaveLength(1)
    // All three words should be included in the union box
    expect(boxes[0].x).toBeCloseTo(0 / W)
    expect(boxes[0].width).toBeCloseTo(120 / W)
  })

  it("matches when OCR keeps 'Alc./Vol.' as a single word", () => {
    const words = [word("45%", 0, 0, 40, 20), word("Alc./Vol.", 45, 0, 120, 20)]
    const boxes = computeFieldBoxes(words, "45% Alc./Vol.", W, H)
    expect(boxes).toHaveLength(1)
  })

  it("matches when OCR splits the number and '%' into separate words (real Google Vision tokenization)", () => {
    // demo-TTB-2026-1007 regression: Google Vision tokenized "40% ALC./VOL." as
    // three words — "40", "%", "ALC./VOL" — not a single "40%" token. The box
    // must still span from "40" through "ALC./VOL", not just the last word.
    const words = [
      word("40", 0, 0, 30, 20),
      word("%", 32, 0, 50, 20),
      word("ALC./VOL", 55, 0, 120, 20),
    ]
    const boxes = computeFieldBoxes(words, "40% ALC./VOL.", W, H)
    expect(boxes).toHaveLength(1)
    expect(boxes[0].x).toBeCloseTo(0 / W)
    expect(boxes[0].width).toBeCloseTo(120 / W)
  })
})

describe("extractFields — fuzzy fallback", () => {
  it("resolves brand name despite a dropped letter not covered by exact matching", () => {
    // "DISTILERY" (missing an 'L') would fail matchExact's substring check.
    const text = "ABC DISTILERY\nFREDERICK, MD\nSTRAIGHT RYE WHISKY"
    const result = extractFields(text, { brandName: "ABC DISTILLERY" })
    expect(result.brandName).toBe("ABC DISTILLERY")
  })

  it("still returns null when the hint has no meaningful overlap with the OCR text", () => {
    const result = extractFields(OCR_TEXT, { brandName: "Totally Different Brand Name" })
    expect(result.brandName).toBeNull()
  })

  it("resolves government warning despite scattered OCR line noise between key words", () => {
    const text =
      "GOVERNMENT WARNNING (1) According to the Surgeon General women should not drink " +
      "alcoholic beverages during pregnancy because of the risk of birth defects (2) Consumption " +
      "of alcoholic beverages impairs your ability to drive a car or operate machinery and may " +
      "cause health problems"
    const hint =
      "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems."
    const result = extractFields(text, { governmentWarning: hint })
    expect(result.governmentWarning).toBe(hint)
  })
})

describe("computeFieldBoxes — invariant: extracted value always yields a box", () => {
  it("ABV: if extractFields returns a non-null abv, computeFieldBoxes must return a box", () => {
    // extractFields uses matchAbv which returns the OCR text form of the ABV,
    // so the words provided here must be a realistic segmentation of that OCR text.
    const extracted = extractFields(OCR_TEXT, { abv: "45% ABV" })
    expect(extracted.abv).not.toBeNull()

    // Simulate OCR word list where "Alc./Vol." is split (the failing case pre-fix)
    const words = [
      word("DISTILLED", 0, 0, 80, 12),
      word("AND", 85, 0, 110, 12),
      word("BOTTLED", 115, 0, 175, 12),
      word("BY:", 180, 0, 200, 12),
      word("ABC", 0, 20, 40, 32),
      word("DISTILLERY", 45, 20, 140, 32),
      word("750ml", 0, 40, 60, 52),
      word("45%", 0, 60, 40, 72),
      word("Alc.", 45, 60, 80, 72),
      word("Vol.", 82, 60, 120, 72),
    ]

    const boxes = computeFieldBoxes(words, extracted.abv, W, H)
    expect(boxes.length).toBeGreaterThan(0)
  })

  it("brandName: if extractFields returns a non-null brandName, computeFieldBoxes must return a box", () => {
    const extracted = extractFields(OCR_TEXT, { brandName: "ABC DISTILLERY" })
    expect(extracted.brandName).not.toBeNull()

    const words = [
      word("ABC", 0, 20, 40, 32),
      word("DISTILLERY", 45, 20, 140, 32),
    ]
    const boxes = computeFieldBoxes(words, extracted.brandName, W, H)
    expect(boxes.length).toBeGreaterThan(0)
  })

  it("netContents: if extractFields returns a non-null netContents, computeFieldBoxes must return a box", () => {
    const extracted = extractFields(OCR_TEXT, { netContents: "750 mL" })
    expect(extracted.netContents).not.toBeNull()

    // OCR_TEXT has "750ml" as a single token
    const words = [word("750ml", 0, 40, 60, 52)]
    const boxes = computeFieldBoxes(words, extracted.netContents, W, H)
    expect(boxes.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// computeFieldBoxes — coverage score (partial fuzzy matching)
// ---------------------------------------------------------------------------

describe("computeFieldBoxes — confidence score", () => {
  it("scores a perfect consecutive match as confidence 1", () => {
    const words = [word("ABC", 0, 0, 100, 20), word("DISTILLERY", 110, 0, 300, 20)]
    const boxes = computeFieldBoxes(words, "ABC DISTILLERY", W, H)
    expect(boxes[0].confidence).toBe(1)
  })

  it("returns a partial-coverage box when OCR truncates the last word of a multi-word value", () => {
    // OCR captured "OLD TOM DISTIL" — the final word of "OLD TOM DISTILLERY" got cut off.
    const words = [
      word("OLD", 0, 0, 100, 20),
      word("TOM", 110, 0, 200, 20),
      word("DISTIL", 210, 0, 300, 20),
    ]
    const boxes = computeFieldBoxes(words, "OLD TOM DISTILLERY", W, H)
    expect(boxes).toHaveLength(1)
    expect(boxes[0].confidence).toBeGreaterThanOrEqual(0.6)
    expect(boxes[0].confidence).toBeLessThan(1)
    // Box should cover all three matched words, not just a subset.
    expect(boxes[0].width).toBeCloseTo(300 / W)
  })

  it("falls back to a scattered single-word box when contiguous coverage falls below the floor", () => {
    // Below the old all-or-nothing contiguous floor, but "OLD" is still a genuine,
    // locatable word from the hint — show that disconnected match instead of nothing.
    const words = [word("OLD", 0, 0, 100, 20)]
    const boxes = computeFieldBoxes(words, "OLD TOM DISTILLERY RESERVE BOURBON", W, H)
    expect(boxes).toHaveLength(1)
    expect(boxes[0].width).toBeCloseTo(100 / W)
  })

  it("returns no boxes when nothing in the field value overlaps the OCR words at all", () => {
    const words = [word("UNRELATED", 0, 0, 100, 20)]
    const boxes = computeFieldBoxes(words, "OLD TOM DISTILLERY RESERVE BOURBON", W, H)
    expect(boxes).toEqual([])
  })
})
