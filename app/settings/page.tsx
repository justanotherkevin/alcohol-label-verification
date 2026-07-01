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
  {
    id: "mock",
    label: "Mock (Testing)",
    cost: "Free",
    description: "Returns fixed test data. No API key needed.",
    requiresKey: false,
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
    <div className="px-8 py-8 max-w-2xl">
      <div className="mb-8">
        <h1
          className="text-2xl font-bold text-on-surface"
          style={{ fontFamily: "var(--font-inter)" }}
        >
          Settings
        </h1>
        <p className="text-sm text-on-surface-muted mt-1">
          Choose your OCR provider. API keys are stored in your browser only and never sent to our
          servers. Estimates vary by image resolution.
        </p>
      </div>

      <div className="space-y-3">
        {PROVIDERS.map((p) => (
          <label
            key={p.id}
            className={`flex items-start gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${
              provider === p.id
                ? "border-primary bg-surface-dim"
                : "border-outline bg-surface-card hover:border-outline-variant"
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
                <span className="font-medium text-on-surface">{p.label}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-surface-dim text-on-surface-muted">
                  {p.cost}
                </span>
              </div>
              <p className="text-sm text-on-surface-muted mt-0.5">{p.description}</p>
            </div>
          </label>
        ))}
      </div>

      {selectedProvider?.requiresKey && (
        <div className="mt-6">
          <label className="block text-sm font-medium text-on-surface-dim mb-1">
            API Key for {selectedProvider.label}
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="API key"
            className="w-full border border-outline rounded-lg px-3 py-2 text-sm font-mono bg-surface-card text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
          />
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-hover transition-colors"
        >
          Save Settings
        </button>
        {saved && <span className="text-sm text-bp-success">Saved!</span>}
      </div>
    </div>
  )
}
