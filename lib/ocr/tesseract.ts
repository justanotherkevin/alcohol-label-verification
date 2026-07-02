import { createWorker } from "tesseract.js"
import { computeFieldBbox, extractFields, WordLike } from "./extraction"
import { BoundingBoxMap, ExtractedLabelData, GuidedSearchHints, OcrProvider, OcrResult } from "./types"

export function logRawOcrText(provider: string, text: string): void {
  if (process.env.NODE_ENV === "development") {
    console.log(`[OCR:${provider}] raw text:\n${text}`)
  }
}

export const tesseractOcrProvider: OcrProvider = {
  name: "tesseract",
  async extract(imageBase64: string, _mimeType: string, hints?: GuidedSearchHints): Promise<OcrResult> {
    const buffer = Buffer.from(imageBase64, "base64")
    const worker = await createWorker("eng")
    let text = ""
    let words: WordLike[] = []
    let W = 0
    let H = 0
    try {
      const { data } = await worker.recognize(buffer)
      text = data.text
      logRawOcrText("tesseract", text)
      words = (data.blocks ?? [])
        .flatMap((b) => b.paragraphs)
        .flatMap((p) => p.lines)
        .flatMap((l) => l.words)
      W = words.length > 0 ? Math.max(...words.map((w) => w.bbox.x1)) : 0
      H = words.length > 0 ? Math.max(...words.map((w) => w.bbox.y1)) : 0
    } finally {
      await worker.terminate()
    }

    const extracted = extractFields(text, hints)

    const boundingBoxes: BoundingBoxMap = {}
    for (const field of Object.keys(extracted) as (keyof ExtractedLabelData)[]) {
      boundingBoxes[field] = computeFieldBbox(words, extracted[field], W, H)
    }

    return { data: extracted, confidence: {}, boundingBoxes, rawText: text }
  },
}
