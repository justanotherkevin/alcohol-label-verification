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
    <main className="max-w-5xl mx-auto px-4 py-8">
      {showNotif && (
        <Notification
          total={notifTotal}
          completed={notifCompleted}
          entries={notifEntries}
          done={notifDone}
        />
      )}

      <h1 className="text-2xl font-semibold text-gray-900 mb-2">Batch Verification</h1>
      <p className="text-sm text-gray-500 mb-8">
        Upload multiple label images and a CSV with application data. Results stream in as each
        label is processed.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Label Images</label>
          <input
            data-testid="images-input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={handleImages}
            className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          {imageFiles.length > 0 && (
            <p className="text-xs text-gray-500 mt-1">{imageFiles.length} image(s) selected</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Application Data (CSV)
          </label>
          <input
            data-testid="csv-input"
            type="file"
            accept=".csv"
            onChange={handleCsv}
            className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          {csvError && <p className="text-xs text-red-600 mt-1">{csvError}</p>}
          {csvRows.length > 0 && (
            <p className="text-xs text-gray-500 mt-1">{csvRows.length} row(s) loaded</p>
          )}
        </div>
      </div>

      <p className="text-xs text-gray-400 mb-6">
        CSV must include columns:{" "}
        <code className="bg-gray-100 px-1 rounded">
          filename, brandName, classType, abv, netContents, bottler, countryOfOrigin,
          governmentWarning
        </code>
      </p>

      <button
        onClick={handleSubmit}
        disabled={processing || csvRows.length === 0 || imageFiles.length === 0}
        className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {processing ? "Processing…" : "Verify All"}
      </button>

      {results.length > 0 && (
        <div className="mt-8 space-y-4">
          <h2 className="text-lg font-medium text-gray-900">Results</h2>
          {results.map((r, i) => (
            <div
              key={i}
              data-testid={`result-card-${i}`}
              className="border border-gray-200 rounded-lg overflow-hidden bg-white"
            >
              <div
                className={`flex items-center justify-between px-4 py-3 ${
                  r.error ? "bg-gray-50" : r.result?.overallPass ? "bg-green-50" : "bg-red-50"
                }`}
              >
                <span className="text-sm font-medium text-gray-900">{r.filename}</span>
                {r.error ? (
                  <span className="text-xs text-gray-500">Error</span>
                ) : (
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded ${
                      r.result?.overallPass
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {r.result?.overallPass ? "PASS" : "FAIL"}
                  </span>
                )}
              </div>
              {r.error ? (
                <p className="px-4 py-3 text-sm text-red-600">{r.error}</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-gray-500">
                      <th className="text-left px-4 py-2 font-medium">Field</th>
                      <th className="text-left px-4 py-2 font-medium">Status</th>
                      <th className="text-left px-4 py-2 font-medium">Extracted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.result?.fields.map((f) => (
                      <tr key={f.field} className="border-b border-gray-50">
                        <td className="px-4 py-2 text-gray-700">{f.label}</td>
                        <td className="px-4 py-2">
                          <span
                            className={`font-semibold ${
                              f.status === "pass"
                                ? "text-green-600"
                                : f.status === "missing"
                                  ? "text-yellow-600"
                                  : "text-red-600"
                            }`}
                          >
                            {f.status === "pass" ? "✓" : f.status === "missing" ? "—" : "✗"}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-gray-600 max-w-xs truncate">
                          {f.extracted ?? (
                            <span className="text-gray-400 italic">not found</span>
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
    </main>
  )
}
