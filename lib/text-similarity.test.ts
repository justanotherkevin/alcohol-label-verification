import { describe, it, expect } from "vitest"
import { diceSimilarity } from "./text-similarity"

describe("diceSimilarity", () => {
  it("scores identical strings as 1", () => {
    expect(diceSimilarity("Old Tom Distillery", "Old Tom Distillery")).toBe(1)
  })

  it("scores identical strings as 1 case-insensitively", () => {
    expect(diceSimilarity("OLD TOM", "old tom")).toBe(1)
  })

  it("scores similar strings (single typo) highly but not 1", () => {
    const score = diceSimilarity("Old Tom Distillery", "Old Tom Distilery")
    expect(score).toBeGreaterThan(0.8)
    expect(score).toBeLessThan(1)
  })

  it("scores dissimilar strings low", () => {
    const score = diceSimilarity("Old Tom Distillery", "Zephyr Nightshade Vodka")
    expect(score).toBeLessThan(0.3)
  })

  it("returns 0 for empty strings", () => {
    expect(diceSimilarity("", "Old Tom")).toBe(0)
    expect(diceSimilarity("Old Tom", "")).toBe(0)
  })
})
