import { describe, it, expect } from "vitest"
import {
  isValidClassType,
  detectProductType,
  parseAbv,
  parseNetContentsMl,
  isValidFillSize,
} from "./ttb-rules"

describe("isValidClassType", () => {
  it("recognizes standard spirits", () => {
    expect(isValidClassType("Straight Bourbon Whiskey")).toBe(true)
    expect(isValidClassType("Vodka")).toBe(true)
    expect(isValidClassType("Rum")).toBe(true)
  })
  it("recognizes standard wines", () => {
    expect(isValidClassType("Table Wine")).toBe(true)
    expect(isValidClassType("Sparkling Wine")).toBe(true)
  })
  it("recognizes standard malt", () => {
    expect(isValidClassType("Beer")).toBe(true)
    expect(isValidClassType("India Pale Ale")).toBe(true)
  })
  it("rejects unrecognized designations", () => {
    expect(isValidClassType("Alcoholic Stuff")).toBe(false)
  })
})

describe("detectProductType", () => {
  it("detects spirits", () => {
    expect(detectProductType("Kentucky Straight Bourbon Whiskey")).toBe("spirits")
  })
  it("detects wine", () => {
    expect(detectProductType("Table Wine")).toBe("wine")
  })
  it("detects malt", () => {
    expect(detectProductType("Lager")).toBe("malt")
  })
  it("returns null for unknown", () => {
    expect(detectProductType("Mystery Drink")).toBeNull()
  })
})

describe("parseAbv", () => {
  it("parses simple percent", () => expect(parseAbv("45%")).toBe(45))
  it("parses with label text", () => expect(parseAbv("40% Alc./Vol. (80 Proof)")).toBe(40))
  it("returns null for no number", () => expect(parseAbv("unknown")).toBeNull())
})

describe("parseNetContentsMl", () => {
  it("parses mL", () => expect(parseNetContentsMl("750 mL")).toBe(750))
  it("parses L", () => expect(parseNetContentsMl("1.75 L")).toBe(1750))
  it("parses fl oz", () => expect(parseNetContentsMl("25.4 fl oz")).toBeCloseTo(750, -1))
  it("returns null for unknown format", () => expect(parseNetContentsMl("one bottle")).toBeNull())
})

describe("isValidFillSize", () => {
  it("750mL spirits is valid", () => expect(isValidFillSize(750, "spirits")).toBe(true))
  it("800mL spirits is invalid", () => expect(isValidFillSize(800, "spirits")).toBe(false))
  it("any size for malt is valid", () => expect(isValidFillSize(473, "malt")).toBe(true))
  it("187mL wine is valid", () => expect(isValidFillSize(187, "wine")).toBe(true))
})
