import OpenAI from "openai"
import { OcrProvider, OcrResult } from "./types"
import { EXTRACTION_SYSTEM_PROMPT, parseExtractionResponse, stripCodeFences } from "./llm-prompt"

export function openaiOcrProvider(apiKey: string): OcrProvider {
  return {
    name: "openai",
    async extract(imageBase64: string, mimeType: string): Promise<OcrResult> {
      const client = new OpenAI({ apiKey })
      const response = await client.chat.completions.create({
        model: "gpt-4o",
        max_tokens: 1024,
        messages: [
          { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${imageBase64}` },
              },
              { type: "text", text: "Extract all label fields from this image." },
            ],
          },
        ],
      })
      const text = response.choices[0]?.message?.content ?? ""
      return parseExtractionResponse(stripCodeFences(text))
    },
  }
}
