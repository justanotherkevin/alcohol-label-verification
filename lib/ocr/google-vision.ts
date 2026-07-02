import {
  computeFieldBbox,
  extractAbv,
  extractBottler,
  extractBrandName,
  extractClassType,
  extractCountryOfOrigin,
  extractGovernmentWarning,
  extractNetContents,
  logRawOcrText,
} from "./tesseract"
import { BoundingBoxMap, ExtractedLabelData, OcrProvider, OcrResult } from "./types"

type Vertex = { x?: number; y?: number }

type VisionWord = {
  boundingBox?: { vertices?: Vertex[] }
  symbols?: { text: string }[]
}

type VisionResponse = {
  responses?: {
    error?: { message?: string }
    fullTextAnnotation?: {
      text?: string
      pages?: {
        width?: number
        height?: number
        blocks?: {
          paragraphs?: {
            words?: VisionWord[]
          }[]
        }[]
      }[]
    }
  }[]
}

export function googleVisionOcrProvider(apiKey: string): OcrProvider {
  return {
    name: "google-vision",
    async extract(imageBase64: string, _mimeType: string): Promise<OcrResult> {
      const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [
            {
              image: { content: imageBase64 },
              features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
            },
          ],
        }),
      })

      const json = (await res.json()) as VisionResponse
      const result = json.responses?.[0]
      if (!res.ok || result?.error) {
        throw new Error(result?.error?.message ?? `Google Vision request failed (${res.status})`)
      }

      const text = result?.fullTextAnnotation?.text ?? ""
      logRawOcrText("google-vision", text)
      const page = result?.fullTextAnnotation?.pages?.[0]
      const W = page?.width ?? 0
      const H = page?.height ?? 0

      const words = (page?.blocks ?? [])
        .flatMap((b) => b.paragraphs ?? [])
        .flatMap((p) => p.words ?? [])
        .map((w) => {
          const wordText = (w.symbols ?? []).map((s) => s.text).join("")
          const vertices = w.boundingBox?.vertices ?? []
          const xs = vertices.map((v) => v.x ?? 0)
          const ys = vertices.map((v) => v.y ?? 0)
          return {
            text: wordText,
            bbox: {
              x0: Math.min(...xs),
              y0: Math.min(...ys),
              x1: Math.max(...xs),
              y1: Math.max(...ys),
            },
          }
        })

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

      return { data: extracted, confidence: {}, boundingBoxes, rawText: text }
    },
  }
}
