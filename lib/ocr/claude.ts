import Anthropic from "@anthropic-ai/sdk"
import { OcrProvider, OcrResult } from "./types"
import { EXTRACTION_SYSTEM_PROMPT, parseExtractionResponse, stripCodeFences } from "./llm-prompt"

const SUPPORTED_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const
type SupportedMimeType = (typeof SUPPORTED_MIME_TYPES)[number]

export function claudeOcrProvider(apiKey: string): OcrProvider {
  return {
    name: "claude",
    async extract(imageBase64: string, mimeType: string): Promise<OcrResult> {
      if (!SUPPORTED_MIME_TYPES.includes(mimeType as SupportedMimeType)) {
        throw new Error(`Claude does not support mime type: ${mimeType}`)
      }
      const client = new Anthropic({ apiKey })
      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: EXTRACTION_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mimeType as SupportedMimeType,
                  data: imageBase64,
                },
              },
              { type: "text", text: "Extract all label fields from this image." },
            ],
          },
        ],
      })
      const block = response.content[0]
      const text = block.type === "text" ? block.text : ""
      return parseExtractionResponse(stripCodeFences(text))
    },
  }
}
