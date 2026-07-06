// Traceability suite: each test ties directly to a literal example or
// constraint from the take-home requirements doc (stakeholder interviews),
// not just to verify.ts's implementation details. If one of these fails,
// a core stated requirement is broken, independent of how it's implemented.
import { describe, it, expect } from "vitest"
import { verifyLabel, REQUIRED_GOVERNMENT_WARNING, ApplicationData, FieldResult } from "./verify"
import { fieldSeverity, effectiveSeverity } from "./queue/field-status"
import { validateResolution } from "./queue/resolve"
import { OcrData } from "./queue/types"

const sampleLabelApp: ApplicationData = {
  // "Example Distilled Spirits Label Fields" from the requirements doc
  brandName: "OLD TOM DISTILLERY",
  classType: "Kentucky Straight Bourbon Whiskey",
  abv: "45% Alc./Vol. (90 Proof)",
  netContents: "750 mL",
  bottler: "Old Tom Distillery, Louisville, KY",
  countryOfOrigin: "USA",
  governmentWarning: REQUIRED_GOVERNMENT_WARNING,
}

describe("Required TTB label fields are all checkable", () => {
  it("ApplicationData carries every field the requirements doc lists as mandatory", () => {
    // Brand name, class/type, alcohol content, net contents, bottler/producer
    // name+address, country of origin, government warning statement.
    const required: (keyof ApplicationData)[] = [
      "brandName",
      "classType",
      "abv",
      "netContents",
      "bottler",
      "countryOfOrigin",
      "governmentWarning",
    ]
    for (const field of required) {
      expect(sampleLabelApp[field]).toBeTruthy()
    }
  })
})

describe("Dave Morrison's judgment example — fuzzy match on formatting", () => {
  it("'STONE'S THROW' on the label matches 'Stone's Throw' in the application", () => {
    const result = verifyLabel(
      { ...sampleLabelApp, brandName: "Stone's Throw" },
      { brandName: "STONE'S THROW", classType: sampleLabelApp.classType, abv: sampleLabelApp.abv, netContents: sampleLabelApp.netContents, bottler: sampleLabelApp.bottler, countryOfOrigin: sampleLabelApp.countryOfOrigin, governmentWarning: sampleLabelApp.governmentWarning }
    )
    const field = result.fields.find((f) => f.field === "brandName")
    expect(field?.status).toBe("pass")
  })
})

describe("Sarah Chen's 5% ABV example — normalized numeric match", () => {
  it("'45% Alc./Vol. (90 Proof)' on the label matches '45% ABV' in the application", () => {
    const result = verifyLabel(
      { ...sampleLabelApp, abv: "45% ABV" },
      { brandName: sampleLabelApp.brandName, classType: sampleLabelApp.classType, abv: "45% Alc./Vol. (90 Proof)", netContents: sampleLabelApp.netContents, bottler: sampleLabelApp.bottler, countryOfOrigin: sampleLabelApp.countryOfOrigin, governmentWarning: sampleLabelApp.governmentWarning }
    )
    const field = result.fields.find((f) => f.field === "abv")
    expect(field?.status).toBe("pass")
  })
})

describe("Jenny Park's government warning example — exact match required", () => {
  it("rejects 'Government Warning' in title case instead of required ALL CAPS", () => {
    const titleCaseWarning = REQUIRED_GOVERNMENT_WARNING.replace(
      "GOVERNMENT WARNING:",
      "Government Warning:"
    )
    const result = verifyLabel(sampleLabelApp, {
      brandName: sampleLabelApp.brandName,
      classType: sampleLabelApp.classType,
      abv: sampleLabelApp.abv,
      netContents: sampleLabelApp.netContents,
      bottler: sampleLabelApp.bottler,
      countryOfOrigin: sampleLabelApp.countryOfOrigin,
      governmentWarning: titleCaseWarning,
    })
    const field = result.fields.find((f) => f.field === "governmentWarning")
    expect(field?.status).toBe("fail")
  })

  it("passes only the exact required wording, word-for-word", () => {
    const result = verifyLabel(sampleLabelApp, {
      brandName: sampleLabelApp.brandName,
      classType: sampleLabelApp.classType,
      abv: sampleLabelApp.abv,
      netContents: sampleLabelApp.netContents,
      bottler: sampleLabelApp.bottler,
      countryOfOrigin: sampleLabelApp.countryOfOrigin,
      governmentWarning: REQUIRED_GOVERNMENT_WARNING,
    })
    const field = result.fields.find((f) => f.field === "governmentWarning")
    expect(field?.status).toBe("pass")
  })
})

describe("Unreadable image handling — does not silently fail", () => {
  it("marks a field 'missing' rather than crashing or force-failing when OCR can't read it", () => {
    const result = verifyLabel(sampleLabelApp, {
      brandName: null,
      classType: sampleLabelApp.classType,
      abv: sampleLabelApp.abv,
      netContents: sampleLabelApp.netContents,
      bottler: sampleLabelApp.bottler,
      countryOfOrigin: sampleLabelApp.countryOfOrigin,
      governmentWarning: sampleLabelApp.governmentWarning,
    })
    const field = result.fields.find((f) => f.field === "brandName")
    expect(field?.status).toBe("missing")
    expect(field?.extracted).toBeNull()
  })
})

function makeField(overrides: Partial<FieldResult> = {}): FieldResult {
  return {
    field: "brandName",
    label: "Brand Name",
    expected: "OLD TOM DISTILLERY",
    extracted: "OLD TOM DISTILLERY",
    status: "pass",
    ...overrides,
  }
}

describe("Dave Morrison's override — reviewer judgment beats the AI verdict", () => {
  it("an 'approve' override reads as pass even when the AI found a fail", () => {
    const field = makeField({ status: "fail" })
    expect(effectiveSeverity(field, { decision: "approve" })).toBe("pass")
  })

  it("a 'flag' override reads as fail even when the AI found a pass", () => {
    const field = makeField({ status: "pass" })
    expect(effectiveSeverity(field, { decision: "flag" })).toBe("fail")
  })

  it("with no override, falls through to the field's natural severity", () => {
    const field = makeField({ status: "fail" })
    expect(effectiveSeverity(field, undefined)).toBe(fieldSeverity(field))
    expect(effectiveSeverity(field, undefined)).toBe("fail")
  })
})

describe("Field severity coloring (pass/warn/fail)", () => {
  it("a text-match fail is 'fail'", () => {
    expect(fieldSeverity(makeField({ status: "fail" }))).toBe("fail")
  })

  it("a missing/unreadable field is 'warn', not a silent pass or hard fail", () => {
    expect(fieldSeverity(makeField({ status: "missing", extracted: null }))).toBe("warn")
  })

  it("a text-match pass with a regulatory warning is still 'warn'", () => {
    expect(
      fieldSeverity(makeField({ status: "pass", regulatory: { status: "warning", note: "low confidence" } }))
    ).toBe("warn")
  })

  it("a clean pass on both checks is 'pass'", () => {
    expect(fieldSeverity(makeField({ status: "pass" }))).toBe("pass")
  })
})

function makeOcrData(fields: FieldResult[]): OcrData {
  return {
    extracted: {
      brandName: sampleLabelApp.brandName,
      classType: sampleLabelApp.classType,
      abv: sampleLabelApp.abv,
      netContents: sampleLabelApp.netContents,
      bottler: sampleLabelApp.bottler,
      countryOfOrigin: sampleLabelApp.countryOfOrigin,
      governmentWarning: sampleLabelApp.governmentWarning,
    },
    confidence: {},
    result: { overallPass: fields.every((f) => f.status === "pass"), fields },
    analyzedAt: new Date().toISOString(),
  }
}

describe("Approve requires every field pass or overridden — users-flow.md Flow 1 step 6", () => {
  it("cannot approve with a flagged field and no override", () => {
    const flagged = makeField({ field: "abv", status: "fail" })
    const analysis = makeOcrData([makeField(), flagged])
    const outcome = validateResolution(analysis, {
      decision: "approved",
      overrides: [],
      rejectedFields: [],
      note: "",
    })
    expect(outcome.ok).toBe(false)
  })

  it("can approve once the flagged field is overridden", () => {
    const flagged = makeField({ field: "abv", status: "fail" })
    const analysis = makeOcrData([makeField(), flagged])
    const outcome = validateResolution(analysis, {
      decision: "approved",
      overrides: [{ field: "abv", decision: "approve", reason: "Confirmed correct on the bottle" }],
      rejectedFields: [],
      note: "",
    })
    expect(outcome.ok).toBe(true)
  })
})

describe("Reject requires citing a still-flagged field plus a note — users-flow.md Flow 1 step 6", () => {
  it("cannot reject with zero cited reason", () => {
    const flagged = makeField({ field: "abv", status: "fail" })
    const analysis = makeOcrData([makeField(), flagged])
    const outcome = validateResolution(analysis, {
      decision: "rejected",
      overrides: [],
      rejectedFields: [],
      note: "Rejected",
    })
    expect(outcome.ok).toBe(false)
  })

  it("cannot cite a field that isn't actually flagged", () => {
    const analysis = makeOcrData([makeField()])
    const outcome = validateResolution(analysis, {
      decision: "rejected",
      overrides: [],
      rejectedFields: ["brandName"],
      note: "Rejected",
    })
    expect(outcome.ok).toBe(false)
  })

  it("cannot reject with an empty note", () => {
    const flagged = makeField({ field: "abv", status: "fail" })
    const analysis = makeOcrData([makeField(), flagged])
    const outcome = validateResolution(analysis, {
      decision: "rejected",
      overrides: [],
      rejectedFields: ["abv"],
      note: "",
    })
    expect(outcome.ok).toBe(false)
  })

  it("passes with a genuinely flagged field cited and a non-empty note", () => {
    const flagged = makeField({ field: "abv", status: "fail" })
    const analysis = makeOcrData([makeField(), flagged])
    const outcome = validateResolution(analysis, {
      decision: "rejected",
      overrides: [],
      rejectedFields: ["abv"],
      note: "ABV on label does not match application",
    })
    expect(outcome.ok).toBe(true)
  })
})
