import { getProvider } from "@/lib/ocr"
import { verifyLabel } from "@/lib/verify"
import { LabelImage, QueueApplication, OcrData } from "./types"

export interface AnalyzeResult {
  ocrData: OcrData
  images: LabelImage[]
}

export async function analyzeApplication(
  app: QueueApplication,
  providerName: string,
  apiKey?: string
): Promise<AnalyzeResult> {
  const provider = getProvider(providerName, apiKey)
  const primaryImage = app.images[0]
  const ocrResult = await provider.extract(primaryImage.base64, primaryImage.mimeType, app.applicationData)
  const result = verifyLabel(app.applicationData, ocrResult.data, ocrResult.confidence)
  const ocrData: OcrData = {
    extracted: ocrResult.data,
    confidence: ocrResult.confidence,
    boundingBoxes: ocrResult.boundingBoxes,
    result,
    analyzedAt: new Date().toISOString(),
  }
  const images: LabelImage[] = app.images.map((img, i) =>
    i === 0 && ocrResult.rawText ? { ...img, rawOcrText: ocrResult.rawText } : img
  )
  return { ocrData, images }
}
