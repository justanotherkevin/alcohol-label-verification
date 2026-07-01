import { OcrProvider } from "./types"
import { tesseractOcrProvider } from "./tesseract"
import { mockOcrProvider } from "./mock"
import { claudeOcrProvider } from "./claude"
import { geminiOcrProvider } from "./gemini"
import { openaiOcrProvider } from "./openai"
import { googleVisionOcrProvider } from "./google-vision"

export function getProvider(name: string, apiKey?: string): OcrProvider {
  switch (name) {
    case "mock":
      return mockOcrProvider
    case "claude":
      return claudeOcrProvider(apiKey ?? "")
    case "gemini":
      return geminiOcrProvider(apiKey ?? "")
    case "openai":
      return openaiOcrProvider(apiKey ?? "")
    case "google-vision":
      return googleVisionOcrProvider(apiKey ?? "")
    case "tesseract":
    default:
      return tesseractOcrProvider
  }
}

export type { ExtractedLabelData, OcrProvider, OcrResult, ConfidenceMap } from "./types"
