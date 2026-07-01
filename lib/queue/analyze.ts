import { getProvider } from "@/lib/ocr"
import { verifyLabel } from "@/lib/verify"
import { QueueApplication, QueueAnalysis } from "./types"

export async function analyzeApplication(
  app: QueueApplication,
  providerName: string,
  apiKey?: string
): Promise<QueueAnalysis> {
  const provider = getProvider(providerName, apiKey)
  const ocrResult = await provider.extract(app.imageBase64, app.imageMimeType)
  const result = verifyLabel(app.applicationData, ocrResult.data, ocrResult.confidence)
  return {
    extracted: ocrResult.data,
    confidence: ocrResult.confidence,
    boundingBoxes: ocrResult.boundingBoxes,
    result,
    analyzedAt: new Date().toISOString(),
  }
}
