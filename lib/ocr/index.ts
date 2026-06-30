import { OcrProvider } from "./types"
import { tesseractOcrProvider } from "./tesseract"
import { mockOcrProvider } from "./mock"

export function getProvider(name: string, apiKey?: string): OcrProvider {
  switch (name) {
    case "mock":
      return mockOcrProvider
    case "claude": {
      // require() used for lazy loading — provider files added in Task 2
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { claudeOcrProvider } = require("./claude") as { claudeOcrProvider: (key: string) => OcrProvider }
      return claudeOcrProvider(apiKey ?? "")
    }
    case "gemini": {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { geminiOcrProvider } = require("./gemini") as { geminiOcrProvider: (key: string) => OcrProvider }
      return geminiOcrProvider(apiKey ?? "")
    }
    case "openai": {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { openaiOcrProvider } = require("./openai") as { openaiOcrProvider: (key: string) => OcrProvider }
      return openaiOcrProvider(apiKey ?? "")
    }
    case "tesseract":
    default:
      return tesseractOcrProvider
  }
}

export type { ExtractedLabelData, OcrProvider, OcrResult, ConfidenceMap } from "./types"
