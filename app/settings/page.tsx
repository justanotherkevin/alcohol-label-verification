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
    id: "google-vision",
    label: "Google Cloud Vision",
    cost: "~$0.0015 / label",
    description: "Dedicated OCR engine with precise word-level bounding boxes. First 1,000 requests/month are free — this app doesn't track usage against that quota.",
    requiresKey: true,
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
  const [pendingCount, setPendingCount] = useState(0)
  const [analyzing, setAnalyzing] = useState(false)
  const [adding, setAdding] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [devMessage, setDevMessage] = useState<{ text: string; ok: boolean } | null>(null)

  useEffect(() => {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as { provider?: string; apiKey?: string }
      setProvider(parsed.provider ?? "tesseract")
      setApiKey(parsed.apiKey ?? "")
    }
  }, [])

  async function loadPendingCount() {
    const res = await fetch("/api/queue?page=1&pageSize=1")
    const data = (await res.json()) as { counts: { pending: number } }
    setPendingCount(data.counts.pending)
  }

  useEffect(() => {
    loadPendingCount()
  }, [])

  function handleSave() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ provider, apiKey }))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleReset() {
    setResetting(true)
    const res = await fetch("/api/queue/reset", { method: "DELETE" })
    await loadPendingCount()
    setResetting(false)
    setDevMessage({
      text: res.ok ? "Queue reset to seed data." : "Resetting seed data is disabled in production.",
      ok: res.ok,
    })
    setTimeout(() => setDevMessage(null), 3000)
  }

  async function handleAddMock() {
    setAdding(true)
    const res = await fetch("/api/queue", { method: "POST" })
    await loadPendingCount()
    setAdding(false)
    setDevMessage({
      text: res.ok
        ? "Mock application added to the queue."
        : "Adding mock applications is disabled in production.",
      ok: res.ok,
    })
    setTimeout(() => setDevMessage(null), 3000)
  }

  async function handleAnalyze() {
    setAnalyzing(true)
    let settings: { provider?: string; apiKey?: string } = {}
    try {
      settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") as typeof settings
    } catch { /* ignore malformed localStorage */ }
    await fetch("/api/queue/analyze", {
      method: "POST",
      headers: {
        "X-Ocr-Provider": settings.provider ?? "mock",
        ...(settings.apiKey ? { "X-Api-Key": settings.apiKey } : {}),
      },
    })
    await loadPendingCount()
    setAnalyzing(false)
    setDevMessage({ text: "Pre-analysis complete.", ok: true })
    setTimeout(() => setDevMessage(null), 3000)
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

      <div className="mt-10 pt-8 border-t border-outline">
        <h2
          className="text-lg font-bold text-on-surface"
          style={{ fontFamily: "var(--font-inter)" }}
        >
          Development tools
        </h2>
        <p className="text-sm text-on-surface-muted mt-1">
          These buttons manipulate the queue directly and exist to make it easy to demo and test
          this app without a real intake pipeline. &quot;Reset seed data&quot; and &quot;Add mock
          application&quot; are disabled on the production deployment to avoid wiping real queue
          data. &quot;Run pre-analysis now&quot; stays enabled everywhere — it&apos;s the only way
          pending applications get analyzed, not just a demo convenience.
        </p>

        <div className="mt-4 space-y-3">
          <div className="flex items-start justify-between gap-4 p-4 rounded-lg border border-outline bg-surface-card">
            <div>
              <p className="text-sm font-medium text-on-surface">Reset seed data</p>
              <p className="text-sm text-on-surface-muted mt-0.5">
                Deletes every application currently in the queue and replaces them with the
                original fixed set of sample applications. Use this to return to a known-clean
                starting point after testing — for example, after you&apos;ve resolved or rejected
                several applications and want the dashboard to look like a fresh install again.
              </p>
            </div>
            <button
              onClick={handleReset}
              disabled={resetting}
              className="shrink-0 text-xs px-3 py-2 border border-outline rounded-lg text-on-surface-dim hover:bg-surface-dim transition-colors disabled:opacity-50"
            >
              {resetting ? "Resetting…" : "Reset seed data"}
            </button>
          </div>

          <div className="flex items-start justify-between gap-4 p-4 rounded-lg border border-outline bg-surface-card">
            <div>
              <p className="text-sm font-medium text-on-surface">+ Add mock application</p>
              <p className="text-sm text-on-surface-muted mt-0.5">
                Inserts one randomly-generated application (based on the sample templates) into
                the queue in &quot;pending&quot; status. Use this when you want to test the
                pre-analysis or review flow on a new application without waiting for a real
                submission.
              </p>
            </div>
            <button
              onClick={handleAddMock}
              disabled={adding}
              className="shrink-0 text-xs px-3 py-2 border border-outline rounded-lg text-on-surface-dim hover:bg-surface-dim transition-colors disabled:opacity-50"
            >
              {adding ? "Adding…" : "+ Add mock application"}
            </button>
          </div>

          <div className="flex items-start justify-between gap-4 p-4 rounded-lg border border-outline bg-surface-card">
            <div>
              <p className="text-sm font-medium text-on-surface">Run pre-analysis now</p>
              <p className="text-sm text-on-surface-muted mt-0.5">
                Normally, pending applications are pre-analyzed automatically. This button lets
                you trigger that analysis on demand using the OCR provider selected above, instead
                of waiting — useful when you&apos;ve just added a mock application or changed the
                OCR provider and want to see results immediately.
              </p>
            </div>
            <button
              onClick={handleAnalyze}
              disabled={analyzing || pendingCount === 0}
              className="shrink-0 text-xs px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50"
            >
              {analyzing ? "Analyzing…" : `Run pre-analysis now (${pendingCount} pending)`}
            </button>
          </div>
        </div>

        {devMessage && (
          <p className={`mt-3 text-sm ${devMessage.ok ? "text-bp-success" : "text-bp-warning"}`}>
            {devMessage.text}
          </p>
        )}
      </div>
    </div>
  )
}
