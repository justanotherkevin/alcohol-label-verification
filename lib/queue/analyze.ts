import fs from "fs"
import path from "path"
import { getProvider } from "@/lib/ocr"
import { mergeOcrResults } from "@/lib/ocr/merge"
import { verifyLabel } from "@/lib/verify"
import { LabelImage, QueueApplication, OcrData } from "./types"
import { updateApplication } from "./store"

export interface AnalyzeResult {
  ocrData: OcrData
  images: LabelImage[]
}

function readImageBase64(imagePath: string): string {
  const publicDir = path.join(process.cwd(), "public")
  const resolved = path.join(publicDir, imagePath)
  if (!resolved.startsWith(publicDir + path.sep)) {
    throw new Error(`Refusing to read image path outside public/: ${imagePath}`)
  }
  return fs.readFileSync(resolved).toString("base64")
}

export async function analyzeApplication(
  app: QueueApplication,
  providerName: string,
  apiKey?: string
): Promise<AnalyzeResult> {
  const provider = getProvider(providerName, apiKey)
  const perImageResults = await Promise.all(
    app.images.map((img) => {
      const base64 = readImageBase64(img.path)
      return provider.extract(base64, img.mimeType, app.applicationData)
    })
  )
  const merged = mergeOcrResults(perImageResults)
  const result = verifyLabel(app.applicationData, merged.data, merged.confidence, merged.conflicts)
  const ocrData: OcrData = {
    extracted: merged.data,
    confidence: merged.confidence,
    boundingBoxes: merged.boundingBoxes,
    result,
    analyzedAt: new Date().toISOString(),
  }
  const images: LabelImage[] = app.images.map((img, i) =>
    merged.rawTexts[i] ? { ...img, rawOcrText: merged.rawTexts[i] } : img
  )
  return { ocrData, images }
}

export async function runAnalysis(
  apps: QueueApplication[],
  providerName: string,
  apiKey?: string
): Promise<string[]> {
  const analyzedIds: string[] = []
  for (const app of apps) {
    const { ocrData, images } = await analyzeApplication(app, providerName, apiKey)
    await updateApplication(app.id, { status: "analyzed", ocrData, images })
    analyzedIds.push(app.id)
  }
  return analyzedIds
}
