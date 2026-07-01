import { describe, it, expect } from "vitest"
import { computeFieldBbox } from "./tesseract"

type MockWord = { text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }

const WORDS: MockWord[] = [
  { text: "OLD",     bbox: { x0: 50,  y0: 20,  x1: 120, y1: 60  } },
  { text: "TOM",     bbox: { x0: 130, y0: 20,  x1: 200, y1: 60  } },
  { text: "Bourbon", bbox: { x0: 60,  y0: 100, x1: 180, y1: 130 } },
  { text: "750",     bbox: { x0: 80,  y0: 200, x1: 130, y1: 220 } },
  { text: "mL",      bbox: { x0: 135, y0: 200, x1: 170, y1: 220 } },
]

const W = 400
const H = 500

describe("computeFieldBbox", () => {
  it("returns union bbox for words matching the field value, normalized", () => {
    const bbox = computeFieldBbox(WORDS, "OLD TOM", W, H)
    expect(bbox).not.toBeNull()
    expect(bbox!.x).toBeCloseTo(50 / W)
    expect(bbox!.y).toBeCloseTo(20 / H)
    expect(bbox!.width).toBeCloseTo((200 - 50) / W)
    expect(bbox!.height).toBeCloseTo((60 - 20) / H)
  })

  it("returns null when no words match the field value", () => {
    const bbox = computeFieldBbox(WORDS, "COGNAC", W, H)
    expect(bbox).toBeNull()
  })

  it("returns null for empty or null field value", () => {
    expect(computeFieldBbox(WORDS, null, W, H)).toBeNull()
    expect(computeFieldBbox(WORDS, "", W, H)).toBeNull()
  })

  it("returns null when words array is empty", () => {
    const bbox = computeFieldBbox([], "OLD TOM", W, H)
    expect(bbox).toBeNull()
  })

  it("computes correct union across non-adjacent words", () => {
    const bbox = computeFieldBbox(WORDS, "750 mL", W, H)
    expect(bbox).not.toBeNull()
    expect(bbox!.x).toBeCloseTo(80 / W)
    expect(bbox!.y).toBeCloseTo(200 / H)
    expect(bbox!.width).toBeCloseTo((170 - 80) / W)
    expect(bbox!.height).toBeCloseTo((220 - 200) / H)
  })
})
