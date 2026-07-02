import { getProvider } from "@/lib/ocr"
import { verifyLabel } from "@/lib/verify"
import { LabelImage, QueueApplication, QueueAnalysis } from "./types"

export interface AnalyzeResult {
  analysis: QueueAnalysis
  images: LabelImage[]
}

export async function analyzeApplication(
  app: QueueApplication,
  providerName: string,
  apiKey?: string
): Promise<AnalyzeResult> {
  const provider = getProvider(providerName, apiKey)
  const primaryImage = app.images[0]
  const ocrResult = await provider.extract(primaryImage.base64, primaryImage.mimeType)
  const result = verifyLabel(app.applicationData, ocrResult.data, ocrResult.confidence)
  const analysis: QueueAnalysis = {
    extracted: ocrResult.data,
    confidence: ocrResult.confidence,
    boundingBoxes: ocrResult.boundingBoxes,
    result,
    analyzedAt: new Date().toISOString(),
  }
  const images: LabelImage[] = app.images.map((img, i) =>
    i === 0 && ocrResult.rawText ? { ...img, rawOcrText: ocrResult.rawText } : img
  )
  return { analysis, images }
}
