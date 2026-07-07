// Human-readable provider names, shared between the sidebar's "OCR Engine"
// footer and any toast/confirmation copy that needs to say which provider
// actually ran. Client-safe (pure data, no server-only imports).
export const PROVIDER_LABELS: Record<string, string> = {
  tesseract: "Tesseract",
  "google-vision": "Google Vision",
  claude: "Claude",
  gemini: "Gemini",
  openai: "OpenAI",
  mock: "Mock",
}
