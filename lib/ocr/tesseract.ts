import { createWorker, OEM, PSM } from "tesseract.js"
import sharp from "sharp"
import { computeFieldBbox, extractFields, WordLike } from "./extraction"
import { BoundingBoxMap, ExtractedLabelData, GuidedSearchHints, OcrProvider, OcrResult } from "./types"

export function logRawOcrText(provider: string, text: string): void {
  if (process.env.NODE_ENV === "development") {
    console.log(`[OCR:${provider}] raw text:\n${text}`)
  }
}

// PSM.SPARSE_TEXT + no preprocessing was the empirical winner of a 32-config grid
// search against a verified ground-truth set (see docs/2026-07-05-tesseract-grid-search-results.md).
// Labels have scattered, disconnected text regions rather than one contiguous block,
// and preprocessing steps like invert actively hurt accuracy on this label set.
export const tesseractOcrProvider: OcrProvider = {
  name: "tesseract",
  async extract(imageBase64: string, _mimeType: string, hints?: GuidedSearchHints): Promise<OcrResult> {
    const buffer = Buffer.from(imageBase64, "base64")
    const { width, height } = await sharp(buffer).metadata()
    const worker = await createWorker("eng", OEM.LSTM_ONLY)
    let text = ""
    let words: WordLike[] = []
    const W = width ?? 0
    const H = height ?? 0
    try {
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT })
      const { data } = await worker.recognize(buffer, {}, { blocks: true })
      text = data.text
      logRawOcrText("tesseract", text)
      words = (data.blocks ?? [])
        .flatMap((b) => b.paragraphs)
        .flatMap((p) => p.lines)
        .flatMap((l) => l.words)
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
