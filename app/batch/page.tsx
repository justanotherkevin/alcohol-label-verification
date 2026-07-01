"use client"

import { useState } from "react"
import Papa from "papaparse"
import Notification from "@/components/Notification"
import { VerificationResult } from "@/lib/verify"
import { ExtractedLabelData, ConfidenceMap } from "@/lib/ocr/types"

interface CsvRow {
  filename: string
  brandName: string
  classType: string
  abv: string
  netContents: string
  bottler: string
  countryOfOrigin: string
  governmentWarning: string
}

interface BatchResult {
  index: number
  filename: string
  extracted?: ExtractedLabelData
  confidence?: ConfidenceMap
  result?: VerificationResult
  error?: string
}

interface NotificationEntry {
  filename: string
  status: "pass" | "fail" | "error"
}

const REQUIRED_COLUMNS = [
  "filename",
  "brandName",
  "classType",
  "abv",
  "netContents",
  "bottler",
  "countryOfOrigin",
  "governmentWarning",
]

const SETTINGS_KEY = "ttb-ocr-settings"

export default function BatchPage() {
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [csvRows, setCsvRows] = useState<CsvRow[]>([])
  const [csvError, setCsvError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [results, setResults] = useState<BatchResult[]>([])
  const [notifTotal, setNotifTotal] = useState(0)
  const [notifCompleted, setNotifCompleted] = useState(0)
  const [notifEntries, setNotifEntries] = useState<NotificationEntry[]>([])
  const [notifDone, setNotifDone] = useState(false)
  const [showNotif, setShowNotif] = useState(false)

  function handleImages(e: React.ChangeEvent<HTMLInputElement>) {
    setImageFiles(Array.from(e.target.files ?? []))
  }

  function handleCsv(e: React.ChangeEvent<HTMLInputElement>) {
    setCsvError(null)
    const file = e.target.files?.[0]
    if (!file) return
    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (parsed) => {
        const cols = parsed.meta.fields ?? []
        const missing = REQUIRED_COLUMNS.filter((c) => !cols.includes(c))
        if (missing.length > 0) {
          setCsvError(`CSV missing required columns: ${missing.join(", ")}`)
          return
        }
        setCsvRows(parsed.data)
      },
    })
  }

  async function handleSubmit() {
    if (csvRows.length === 0 || imageFiles.length === 0) return
    setProcessing(true)
    setResults([])
    setNotifCompleted(0)
    setNotifEntries([])
    setNotifDone(false)
    setNotifTotal(csvRows.length)
    setShowNotif(true)

    const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") as {
      provider?: string
      apiKey?: string
    }
    const providerName = settings.provider ?? "tesseract"
    const apiKey = settings.apiKey ?? ""

    const formData = new FormData()
    formData.append("rows", JSON.stringify(csvRows))
    for (const file of imageFiles) {
      formData.append(`image:${file.name}`, file)
    }

    const res = await fetch("/api/batch", {
      method: "POST",
      headers: {
        "X-Ocr-Provider": providerName,
        ...(apiKey ? { "X-Api-Key": apiKey } : {}),
      },
      body: formData,
    })

    if (!res.body) {
      setProcessing(false)
      return
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split("\n\n")
      buffer = parts.pop() ?? ""
      for (const part of parts) {
        if (!part.startsWith("data: ")) continue
        const payload = JSON.parse(part.slice("data: ".length)) as {
          type: string
          total?: number
          index?: number
          filename?: string
          extracted?: ExtractedLabelData
          confidence?: ConfidenceMap
          result?: VerificationResult
          error?: string
        }
        if (payload.type === "start" && payload.total !== undefined) {
          setNotifTotal(payload.total)
        } else if (payload.type === "result" && payload.index !== undefined && payload.filename) {
          const batchResult: BatchResult = {
            index: payload.index,
            filename: payload.filename,
            extracted: payload.extracted,
            confidence: payload.confidence,
            result: payload.result,
            error: payload.error,
          }
          setResults((prev) => {
            const next = [...prev]
            next[payload.index!] = batchResult
            return next
          })
          setNotifCompleted((n) => n + 1)
          setNotifEntries((prev) => [
            ...prev,
            {
              filename: payload.filename!,
              status: payload.error ? "error" : payload.result?.overallPass ? "pass" : "fail",
            },
          ])
        } else if (payload.type === "done") {
          setNotifDone(true)
          setProcessing(false)
        }
      }
    }

    setProcessing(false)
  }

  return (
    <div className="px-8 py-8 max-w-5xl">
      {showNotif && (
        <Notification
          total={notifTotal}
          completed={notifCompleted}
          entries={notifEntries}
          done={notifDone}
        />
      )}

      <div className="mb-8">
        <h1
          className="text-2xl font-bold text-on-surface"
          style={{ fontFamily: "var(--font-inter)" }}
        >
          Batch Verification
        </h1>
        <p className="text-sm text-on-surface-muted mt-1">
          Upload multiple label images and a CSV with application data. Results stream in as each
          label is processed.
        </p>
      </div>

      <div className="bg-surface-card border border-outline rounded-2xl p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
          <div>
            <label className="block text-sm font-medium text-on-surface-dim mb-2">
              Label Images
            </label>
            <input
              data-testid="images-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={handleImages}
              className="w-full text-sm text-on-surface-dim file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-surface-dim file:text-primary hover:file:bg-outline transition-colors"
            />
            {imageFiles.length > 0 && (
              <p className="text-xs text-on-surface-muted mt-1">{imageFiles.length} image(s) selected</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-on-surface-dim mb-2">
              Application Data (CSV)
            </label>
            <input
              data-testid="csv-input"
              type="file"
              accept=".csv"
              onChange={handleCsv}
              className="w-full text-sm text-on-surface-dim file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-surface-dim file:text-primary hover:file:bg-outline transition-colors"
            />
            {csvError && <p className="text-xs text-bp-error mt-1">{csvError}</p>}
            {csvRows.length > 0 && (
              <p className="text-xs text-on-surface-muted mt-1">{csvRows.length} row(s) loaded</p>
            )}
          </div>
        </div>

        <p className="text-xs text-on-surface-muted mb-6">
          CSV must include columns:{" "}
          <code className="bg-surface-dim px-1 rounded font-mono">
            filename, brandName, classType, abv, netContents, bottler, countryOfOrigin,
            governmentWarning
          </code>
        </p>

        <button
          onClick={handleSubmit}
          disabled={processing || csvRows.length === 0 || imageFiles.length === 0}
          className="px-5 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {processing ? "Processing…" : "Verify All"}
        </button>
      </div>

      {results.length > 0 && (
        <div className="space-y-4">
          <h2
            className="text-base font-semibold text-on-surface"
            style={{ fontFamily: "var(--font-inter)" }}
          >
            Results
          </h2>
          {results.map((r, i) => (
            <div
              key={i}
              data-testid={`result-card-${i}`}
              className="border border-outline rounded-2xl overflow-hidden bg-surface-card"
            >
              <div
                className={`flex items-center justify-between px-4 py-3 ${
                  r.error
                    ? "bg-surface-dim"
                    : r.result?.overallPass
                      ? "bg-bp-success-surface"
                      : "bg-bp-error-surface"
                }`}
              >
                <span className="text-sm font-medium text-on-surface">{r.filename}</span>
                {r.error ? (
                  <span className="text-xs text-on-surface-muted">Error</span>
                ) : (
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded ${
                      r.result?.overallPass
                        ? "bg-bp-success-surface text-bp-success border border-bp-success-border"
                        : "bg-bp-error-surface text-bp-error border border-bp-error-border"
                    }`}
                  >
                    {r.result?.overallPass ? "PASS" : "FAIL"}
                  </span>
                )}
              </div>
              {r.error ? (
                <p className="px-4 py-3 text-sm text-bp-error">{r.error}</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-outline bg-surface-dim text-on-surface-muted">
                      <th className="text-left px-4 py-2 font-medium">Field</th>
                      <th className="text-left px-4 py-2 font-medium">Status</th>
                      <th className="text-left px-4 py-2 font-medium">Extracted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.result?.fields.map((f) => (
                      <tr key={f.field} className="border-b border-outline">
                        <td className="px-4 py-2 text-on-surface-dim">{f.label}</td>
                        <td className="px-4 py-2">
                          <span
                            className={`font-semibold ${
                              f.status === "pass"
                                ? "text-bp-success"
                                : f.status === "missing"
                                  ? "text-bp-warning"
                                  : "text-bp-error"
                            }`}
                          >
                            {f.status === "pass" ? "✓" : f.status === "missing" ? "—" : "✗"}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-on-surface-dim max-w-xs truncate">
                          {f.extracted ?? (
                            <span className="text-on-surface-muted italic">not found</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
