import { describe, it, expect } from "vitest"
import { isFieldFlagged } from "./field-status"
import { FieldResult } from "@/lib/verify"

function field(overrides: Partial<FieldResult> = {}): FieldResult {
  return {
    field: "abv",
    label: "Alcohol Content (ABV)",
    expected: "40%",
    extracted: "40%",
    status: "pass",
    ...overrides,
  }
}

describe("isFieldFlagged", () => {
  it("is not flagged when status is pass and there is no regulatory check", () => {
    expect(isFieldFlagged(field())).toBe(false)
  })

  it("is not flagged when status is pass and regulatory status is pass", () => {
    expect(isFieldFlagged(field({ regulatory: { status: "pass", note: "Within legal range" } }))).toBe(false)
  })

  it("is flagged when status is pass but regulatory status is fail", () => {
    expect(isFieldFlagged(field({ regulatory: { status: "fail", note: "ABV outside legal range" } }))).toBe(true)
  })

  it("is flagged when status is fail regardless of regulatory status", () => {
    expect(isFieldFlagged(field({ status: "fail", regulatory: { status: "pass", note: "Within legal range" } }))).toBe(
      true
    )
    expect(isFieldFlagged(field({ status: "fail" }))).toBe(true)
  })

  it("is not flagged when status is pass and regulatory status is warning or skipped", () => {
    expect(isFieldFlagged(field({ regulatory: { status: "warning", note: "Close to bound" } }))).toBe(false)
    expect(isFieldFlagged(field({ regulatory: { status: "skipped", note: "Not applicable" } }))).toBe(false)
  })
})
