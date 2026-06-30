"use client"

import { useState, useEffect } from "react"

const PROVIDERS = [
  {
    id: "tesseract",
    label: "Tesseract (Local)",
    cost: "Free",
    description: "Runs in the browser. No API key needed. Lower accuracy.",
    requiresKey: false,
  },
  {
    id: "claude",
    label: "Claude Sonnet 4.6",
    cost: "~$0.010 / label",
    description: "Anthropic's vision model. High accuracy.",
    requiresKey: true,
  },
  {
    id: "gemini",
    label: "Gemini 2.0 Flash",
    cost: "~$0.0002 / label",
    description: "Google's vision model. Lowest cost among LLM options.",
    requiresKey: true,
  },
  {
    id: "openai",
    label: "GPT-4o",
    cost: "~$0.008 / label",
    description: "OpenAI's vision model. Strong accuracy.",
    requiresKey: true,
  },
]

export const SETTINGS_KEY = "ttb-ocr-settings"

export default function SettingsPage() {
  const [provider, setProvider] = useState("tesseract")
  const [apiKey, setApiKey] = useState("")
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as { provider?: string; apiKey?: string }
      setProvider(parsed.provider ?? "tesseract")
      setApiKey(parsed.apiKey ?? "")
    }
  }, [])

  function handleSave() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ provider, apiKey }))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const selectedProvider = PROVIDERS.find((p) => p.id === provider)

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold text-gray-900 mb-2">Settings</h1>
      <p className="text-sm text-gray-500 mb-8">
        Choose your OCR provider. API keys are stored in your browser only and never sent to our
        servers. Estimates vary by image resolution.
      </p>

      <div className="space-y-3">
        {PROVIDERS.map((p) => (
          <label
            key={p.id}
            className={`flex items-start gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${
              provider === p.id
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            <input
              type="radio"
              name="provider"
              value={p.id}
              checked={provider === p.id}
              onChange={() => {
                setProvider(p.id)
                if (!p.requiresKey) setApiKey("")
              }}
              className="mt-1"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">{p.label}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                  {p.cost}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">{p.description}</p>
            </div>
          </label>
        ))}
      </div>

      {selectedProvider?.requiresKey && (
        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            API Key for {selectedProvider.label}
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="API key"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Save Settings
        </button>
        {saved && <span className="text-sm text-green-600">Saved!</span>}
      </div>
    </main>
  )
}
