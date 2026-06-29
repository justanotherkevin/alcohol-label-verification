import { OcrProvider } from "./types"
import { mockOcrProvider } from "./mock"

// Swap this out to plug in Claude, GPT-4V, Gemini Vision, etc.
const activeProvider: OcrProvider = mockOcrProvider

export { activeProvider }
export type { ExtractedLabelData, OcrProvider } from "./types"
