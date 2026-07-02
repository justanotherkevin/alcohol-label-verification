import { GoogleGenerativeAI } from "@google/generative-ai"
import { GuidedSearchHints, OcrProvider, OcrResult } from "./types"
import { EXTRACTION_SYSTEM_PROMPT, parseExtractionResponse, stripCodeFences } from "./llm-prompt"

export function geminiOcrProvider(apiKey: string): OcrProvider {
  return {
    name: "gemini",
    async extract(imageBase64: string, mimeType: string, _hints?: GuidedSearchHints): Promise<OcrResult> {
      const genAI = new GoogleGenerativeAI(apiKey)
      const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        systemInstruction: EXTRACTION_SYSTEM_PROMPT,
      })
      const result = await model.generateContent([
        {
          inlineData: {
            mimeType,
            data: imageBase64,
          },
        },
        "Extract all label fields from this image.",
      ])
      const text = result.response.text()
      return parseExtractionResponse(stripCodeFences(text))
    },
  }
}
