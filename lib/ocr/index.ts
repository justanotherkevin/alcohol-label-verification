import { OcrProvider } from "./types"
import { tesseractOcrProvider } from "./tesseract"
import { mockOcrProvider } from "./mock"

export function getProvider(name: string, apiKey?: string): OcrProvider {
  switch (name) {
    case "mock":
      return mockOcrProvider
    case "claude": {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { claudeOcrProvider } = require("./claude")
      return claudeOcrProvider(apiKey ?? "")
    }
    case "gemini": {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { geminiOcrProvider } = require("./gemini")
      return geminiOcrProvider(apiKey ?? "")
    }
    case "openai": {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { openaiOcrProvider } = require("./openai")
      return openaiOcrProvider(apiKey ?? "")
    }
    case "tesseract":
    default:
      return tesseractOcrProvider
  }
}

export type { ExtractedLabelData, OcrProvider, OcrResult, ConfidenceMap } from "./types"
