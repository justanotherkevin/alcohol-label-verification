import { createWorker } from "tesseract.js"
import { BoundingBox, BoundingBoxMap, ExtractedLabelData, OcrProvider, OcrResult } from "./types"

type WordLike = { text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }

export function computeFieldBbox(words: WordLike[], fieldValue: string | null, W: number, H: number): BoundingBox | null {
  if (!fieldValue || words.length === 0 || W === 0 || H === 0) return null
  const tokens = fieldValue.toLowerCase().split(/\s+/).filter(t => t.length > 1)
  if (tokens.length === 0) return null
  const matched = words.filter(w => tokens.some(t => w.text.toLowerCase().includes(t)))
  if (matched.length === 0) return null
  const x0 = Math.min(...matched.map(w => w.bbox.x0))
  const y0 = Math.min(...matched.map(w => w.bbox.y0))
  const x1 = Math.max(...matched.map(w => w.bbox.x1))
  const y1 = Math.max(...matched.map(w => w.bbox.y1))
  return { x: x0 / W, y: y0 / H, width: (x1 - x0) / W, height: (y1 - y0) / H }
}

const GOVERNMENT_WARNING_PREFIX = "GOVERNMENT WARNING:"

function extractAbv(text: string): string | null {
  const match = text.match(/(\d+\.?\d*\s*%\s*(?:Alc\.?\/Vol\.?|alc\.?\/vol\.?|alcohol by volume))/i)
  return match ? match[1].trim() : null
}

function extractNetContents(text: string): string | null {
  const match = text.match(/(\d+\.?\d*\s*(?:mL|ml|L\b|fl\.?\s*oz|oz))/i)
  return match ? match[1].trim() : null
}

function extractGovernmentWarning(text: string): string | null {
  const upper = text.toUpperCase()
  const start = upper.indexOf(GOVERNMENT_WARNING_PREFIX)
  if (start === -1) return null
  // Grab from the match position in the original text
  const slice = text.slice(start)
  // Warning ends at the next double newline or end of string
  const end = slice.search(/\n\s*\n/)
  const raw = end === -1 ? slice : slice.slice(0, end)
  return raw.replace(/\s+/g, " ").trim()
}

function extractBrandName(lines: string[]): string | null {
  // Brand name is typically the first prominent non-empty line
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.length > 2 && trimmed.length < 80) return trimmed
  }
  return null
}

const TTB_CLASS_TYPES = [
  "bourbon whiskey",
  "straight bourbon",
  "kentucky straight bourbon",
  "tennessee whiskey",
  "blended whiskey",
  "scotch whisky",
  "irish whiskey",
  "rye whiskey",
  "vodka",
  "gin",
  "rum",
  "tequila",
  "mezcal",
  "brandy",
  "cognac",
  "wine",
  "malt beverage",
  "beer",
  "ale",
  "lager",
  "hard cider",
]

function extractClassType(text: string): string | null {
  const lower = text.toLowerCase()
  for (const cls of TTB_CLASS_TYPES) {
    const idx = lower.indexOf(cls)
    if (idx !== -1) {
      // Find the full line containing this match
      const lineStart = text.lastIndexOf("\n", idx)
      const lineEnd = text.indexOf("\n", idx)
      const line = text.slice(
        lineStart === -1 ? 0 : lineStart + 1,
        lineEnd === -1 ? undefined : lineEnd
      )
      return line.trim()
    }
  }
  return null
}

function extractBottler(text: string): string | null {
  const match = text.match(/(?:Bottled by|Produced by|Distilled by|Imported by)[^\n]*/i)
  return match ? match[0].trim() : null
}

function extractCountryOfOrigin(text: string): string | null {
  const match = text.match(/(?:Product of|Made in|Imported from)\s+([A-Za-z ]+)/i)
  return match ? match[0].trim() : null
}

export const tesseractOcrProvider: OcrProvider = {
  name: "tesseract",
  async extract(imageBase64: string, _mimeType: string): Promise<OcrResult> {
    const buffer = Buffer.from(imageBase64, "base64")
    const worker = await createWorker("eng")
    let text = ""
    let words: WordLike[] = []
    let W = 0
    let H = 0
    try {
      const { data } = await worker.recognize(buffer)
      text = data.text
      words = (data.blocks ?? [])
        .flatMap(b => b.paragraphs)
        .flatMap(p => p.lines)
        .flatMap(l => l.words)
      W = words.length > 0 ? Math.max(...words.map(w => w.bbox.x1)) : 0
      H = words.length > 0 ? Math.max(...words.map(w => w.bbox.y1)) : 0
    } finally {
      await worker.terminate()
    }

    const lines = text.split("\n").filter((l) => l.trim().length > 0)

    const extracted: ExtractedLabelData = {
      brandName: extractBrandName(lines),
      classType: extractClassType(text),
      abv: extractAbv(text),
      netContents: extractNetContents(text),
      bottler: extractBottler(text),
      countryOfOrigin: extractCountryOfOrigin(text),
      governmentWarning: extractGovernmentWarning(text),
    }

    const boundingBoxes: BoundingBoxMap = {}
    for (const field of Object.keys(extracted) as (keyof ExtractedLabelData)[]) {
      boundingBoxes[field] = computeFieldBbox(words, extracted[field], W, H)
    }

    return { data: extracted, confidence: {}, boundingBoxes }
  },
}
