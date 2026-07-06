import { describe, it, expect } from "vitest"
import { computeFieldBoxes } from "./extraction"

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

describe("computeFieldBoxes", () => {
  it("returns union box for words matching the field value, normalized", () => {
    const boxes = computeFieldBoxes(WORDS, "OLD TOM", W, H)
    expect(boxes).toHaveLength(1)
    expect(boxes[0].x).toBeCloseTo(50 / W)
    expect(boxes[0].y).toBeCloseTo(20 / H)
    expect(boxes[0].width).toBeCloseTo((200 - 50) / W)
    expect(boxes[0].height).toBeCloseTo((60 - 20) / H)
  })

  it("returns no boxes when no words match the field value", () => {
    const boxes = computeFieldBoxes(WORDS, "COGNAC", W, H)
    expect(boxes).toEqual([])
  })

  it("returns no boxes for empty or null field value", () => {
    expect(computeFieldBoxes(WORDS, null, W, H)).toEqual([])
    expect(computeFieldBoxes(WORDS, "", W, H)).toEqual([])
  })

  it("returns no boxes when words array is empty", () => {
    const boxes = computeFieldBoxes([], "OLD TOM", W, H)
    expect(boxes).toEqual([])
  })

  it("computes correct union across non-adjacent words", () => {
    const boxes = computeFieldBoxes(WORDS, "750 mL", W, H)
    expect(boxes).toHaveLength(1)
    expect(boxes[0].x).toBeCloseTo(80 / W)
    expect(boxes[0].y).toBeCloseTo(200 / H)
    expect(boxes[0].width).toBeCloseTo((170 - 80) / W)
    expect(boxes[0].height).toBeCloseTo((220 - 200) / H)
  })
})
