"use client"

import { useState, useRef } from "react"
import { VerificationResult, FieldResult } from "@/lib/verify"
import { ExtractedLabelData, ConfidenceMap } from "@/lib/ocr"

const SETTINGS_KEY = "ttb-ocr-settings"

const DEFAULT_FIELDS = {
  brandName: "OLD TOM DISTILLERY",
  classType: "Kentucky Straight Bourbon Whiskey",
  abv: "45% Alc./Vol. (90 Proof)",
  netContents: "750 mL",
  bottler: "Old Tom Distillery, Louisville, KY",
  countryOfOrigin: "USA",
  governmentWarning:
    "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.",
}

function StatusBadge({ status }: { status: FieldResult["status"] }) {
  if (status === "pass") return <span className="text-green-600 font-bold text-lg">✓</span>
  if (status === "fail") return <span className="text-red-600 font-bold text-lg">✗</span>
  return <span className="text-yellow-500 font-bold text-lg">—</span>
}

function FieldRow({ field, confidence }: { field: FieldResult; confidence?: number }) {
  const bgColor =
    field.status === "pass"
      ? "bg-green-50 border-green-200"
      : field.status === "fail"
        ? "bg-red-50 border-red-200"
        : "bg-yellow-50 border-yellow-200"

  return (
    <div className={`border rounded-lg p-4 ${bgColor}`}>
      <div className="flex items-start gap-3">
        <StatusBadge status={field.status} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
              <p className="font-semibold text-gray-800">{field.label}</p>
              {confidence !== undefined && (
                <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                  {Math.round(confidence * 100)}%
                </span>
              )}
            </div>
          {field.status !== "pass" && (
            <div className="mt-1 text-sm space-y-1">
              <p className="text-gray-500">
                <span className="font-medium">Expected:</span>{" "}
                <span className="font-mono">{field.expected ?? "—"}</span>
              </p>
              <p className="text-red-700">
                <span className="font-medium">Found on label:</span>{" "}
                <span className="font-mono">{field.extracted ?? "not found"}</span>
              </p>
              {field.note && <p className="text-gray-400 italic text-xs mt-1">{field.note}</p>}
            </div>
          )}
          {field.status === "pass" && (
            <p className="text-sm text-gray-500 mt-1 font-mono">{field.extracted}</p>
          )}
          {field.regulatory && field.regulatory.status !== "skipped" && (
            <div className="mt-2 pt-2 border-t border-gray-200">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Regulatory</span>
              <p className={`text-xs mt-0.5 ${field.regulatory.status === "fail" ? "text-red-600" : field.regulatory.status === "warning" ? "text-yellow-600" : "text-green-600"}`}>
                {field.regulatory.status === "fail" ? "✗" : field.regulatory.status === "warning" ? "⚠" : "✓"} {field.regulatory.note}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  const [fields, setFields] = useState(DEFAULT_FIELDS)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<VerificationResult | null>(null)
  const [extracted, setExtracted] = useState<ExtractedLabelData | null>(null)
  const [confidence, setConfidence] = useState<ConfidenceMap>({})
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleImageChange(file: File) {
    setImageFile(file)
    setResult(null)
    setExtracted(null)
    setError(null)
    const reader = new FileReader()
    reader.onload = (e) => setImagePreview(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleImageChange(file)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!imageFile) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append("image", imageFile)
      formData.append("appData", JSON.stringify(fields))

      const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") as {
        provider?: string
        apiKey?: string
      }
      const providerName = settings.provider ?? "tesseract"
      const apiKey = settings.apiKey ?? ""

      const res = await fetch("/api/verify", {
        method: "POST",
        headers: {
          "X-Ocr-Provider": providerName,
          ...(apiKey ? { "X-Api-Key": apiKey } : {}),
        },
        body: formData,
      })
      if (!res.ok) throw new Error("Verification failed")

      const data = await res.json() as { extracted: ExtractedLabelData; confidence: ConfidenceMap; result: VerificationResult }
      setExtracted(data.extracted)
      setConfidence(data.confidence ?? {})
      setResult(data.result)
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">TTB Label Verification</h1>
          <p className="text-gray-500 mt-1">
            Upload a label image and enter the application data to verify compliance.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Image Upload */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-800">Label Image</h2>
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
              >
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Label preview"
                    className="max-h-64 mx-auto rounded-lg object-contain"
                  />
                ) : (
                  <div className="text-gray-400">
                    <p className="text-4xl mb-2">📷</p>
                    <p className="font-medium">Drop label image here</p>
                    <p className="text-sm mt-1">or click to browse</p>
                    <p className="text-xs mt-2">JPG, PNG, WEBP</p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleImageChange(e.target.files[0])}
                />
              </div>
              {imageFile && (
                <p className="text-sm text-gray-500">
                  Selected: <span className="font-medium">{imageFile.name}</span>
                </p>
              )}
            </div>

            {/* Application Data */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-800">Application Data</h2>
              {(
                [
                  ["brandName", "Brand Name"],
                  ["classType", "Class / Type"],
                  ["abv", "Alcohol Content (ABV)"],
                  ["netContents", "Net Contents"],
                  ["bottler", "Bottler / Producer"],
                  ["countryOfOrigin", "Country of Origin"],
                ] as [keyof typeof fields, string][]
              ).map(([key, label]) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input
                    type="text"
                    value={fields[key]}
                    onChange={(e) => setFields({ ...fields, [key]: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Government Warning Statement
                </label>
                <textarea
                  rows={4}
                  value={fields.governmentWarning}
                  onChange={(e) => setFields({ ...fields, governmentWarning: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={!imageFile || loading}
              className="bg-blue-600 text-white font-semibold px-8 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Verifying…" : "Verify Label"}
            </button>
            {loading && (
              <span className="text-gray-500 text-sm animate-pulse">Extracting label data…</span>
            )}
          </div>
        </form>

        {error && (
          <div className="mt-6 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {result && extracted && (
          <div className="mt-10 space-y-6">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-bold text-gray-900">Verification Results</h2>
              <span
                className={`px-4 py-1 rounded-full text-sm font-bold ${
                  result.overallPass ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                }`}
              >
                {result.overallPass ? "PASSED" : "FAILED"}
              </span>
            </div>
            <div className="space-y-3">
              {result.fields.map((field) => (
                <FieldRow
                  key={field.field}
                  field={field}
                  confidence={confidence[field.field as keyof ConfidenceMap]}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
