"use client"

import { useState, useRef, useEffect } from "react"
import { VerificationResult, FieldResult } from "@/lib/verify"
import { ExtractedLabelData, ConfidenceMap, BoundingBoxMap } from "@/lib/ocr/types"

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
  if (status === "pass")
    return <span className="text-bp-success font-bold text-lg">✓</span>
  if (status === "fail")
    return <span className="text-bp-error font-bold text-lg">✗</span>
  return <span className="text-bp-warning font-bold text-lg">—</span>
}

function FieldRow({
  field,
  confidence,
  onClick,
  isSelected,
}: {
  field: FieldResult
  confidence?: number
  onClick?: () => void
  isSelected?: boolean
}) {
  const bgColor =
    field.status === "pass"
      ? "bg-bp-success-surface border-bp-success-border"
      : field.status === "fail"
        ? "bg-bp-error-surface border-bp-error-border"
        : "bg-bp-warning-surface border-bp-warning-border"

  return (
    <div
      className={`border rounded-lg p-4 ${bgColor} ${onClick ? "cursor-pointer" : ""} ${isSelected ? "ring-2 ring-primary" : ""}`}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <StatusBadge status={field.status} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-on-surface">{field.label}</p>
            {confidence !== undefined && (
              <span className="text-xs text-on-surface-muted bg-surface-dim px-1.5 py-0.5 rounded">
                {Math.round(confidence * 100)}%
              </span>
            )}
          </div>
          {field.status !== "pass" && (
            <div className="mt-1 text-sm space-y-1">
              <p className="text-on-surface-dim">
                <span className="font-medium">Expected:</span>{" "}
                <span className="font-mono">{field.expected ?? "—"}</span>
              </p>
              <p className="text-bp-error">
                <span className="font-medium">Found on label:</span>{" "}
                <span className="font-mono">{field.extracted ?? "not found"}</span>
              </p>
              {field.note && (
                <p className="text-on-surface-muted italic text-xs mt-1">{field.note}</p>
              )}
            </div>
          )}
          {field.status === "pass" && (
            <p className="text-sm text-on-surface-dim mt-1 font-mono">{field.extracted}</p>
          )}
          {field.regulatory && field.regulatory.status !== "skipped" && (
            <div className="mt-2 pt-2 border-t border-outline">
              <span className="text-xs font-medium text-on-surface-muted uppercase tracking-wide">
                Regulatory
              </span>
              <p
                className={`text-xs mt-0.5 ${
                  field.regulatory.status === "fail"
                    ? "text-bp-error"
                    : field.regulatory.status === "warning"
                      ? "text-bp-warning"
                      : "text-bp-success"
                }`}
              >
                {field.regulatory.status === "fail"
                  ? "✗"
                  : field.regulatory.status === "warning"
                    ? "⚠"
                    : "✓"}{" "}
                {field.regulatory.note}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function VerifyPage() {
  const [fields, setFields] = useState(DEFAULT_FIELDS)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<VerificationResult | null>(null)
  const [extracted, setExtracted] = useState<ExtractedLabelData | null>(null)
  const [confidence, setConfidence] = useState<ConfidenceMap>({})
  const [boundingBoxes, setBoundingBoxes] = useState<BoundingBoxMap | null>(null)
  const [selectedField, setSelectedField] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img) return

    const w = img.offsetWidth
    const h = img.offsetHeight
    canvas.width = w
    canvas.height = h

    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.clearRect(0, 0, w, h)

    if (!selectedField || !boundingBoxes) return
    const bbox = boundingBoxes[selectedField as keyof BoundingBoxMap]
    if (!bbox) return

    ctx.strokeStyle = "#4c6080"
    ctx.lineWidth = 2
    ctx.fillStyle = "rgba(76, 96, 128, 0.12)"
    ctx.beginPath()
    ctx.rect(bbox.x * w, bbox.y * h, bbox.width * w, bbox.height * h)
    ctx.fill()
    ctx.stroke()
  }, [selectedField, boundingBoxes])

  function handleImageChange(file: File) {
    setImageFile(file)
    setResult(null)
    setExtracted(null)
    setBoundingBoxes(null)
    setSelectedField(null)
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

  function handleFieldClick(fieldKey: string) {
    setSelectedField((prev) => (prev === fieldKey ? null : fieldKey))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!imageFile) return

    setLoading(true)
    setError(null)
    setResult(null)
    setSelectedField(null)

    try {
      const formData = new FormData()
      formData.append("image", imageFile)
      formData.append("appData", JSON.stringify(fields))

      let settings: { provider?: string; apiKey?: string } = {}
      try {
        settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") as typeof settings
      } catch { /* ignore malformed localStorage */ }
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

      const data = (await res.json()) as {
        extracted: ExtractedLabelData
        confidence: ConfidenceMap
        boundingBoxes?: BoundingBoxMap
        result: VerificationResult
      }
      setExtracted(data.extracted)
      setConfidence(data.confidence ?? {})
      setBoundingBoxes(data.boundingBoxes ?? null)
      setResult(data.result)
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="px-8 py-8 max-w-5xl">
      <div className="mb-8">
        <h1
          className="text-2xl font-bold text-on-surface"
          style={{ fontFamily: "var(--font-inter)" }}
        >
          TTB Label Verification
        </h1>
        <p className="text-sm text-on-surface-muted mt-1">
          Upload a label image and enter the application data to verify compliance.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Image Upload */}
          <div className="space-y-4">
            <h2
              className="text-base font-semibold text-on-surface"
              style={{ fontFamily: "var(--font-inter)" }}
            >
              Label Image
            </h2>
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-outline-variant rounded-xl p-8 text-center cursor-pointer hover:border-primary hover:bg-surface-dim transition-colors bg-surface-card"
            >
              {imagePreview ? (
                <div className="relative inline-block mx-auto">
                  <img
                    ref={imgRef}
                    src={imagePreview}
                    alt="Label preview"
                    className="max-h-64 rounded-lg object-contain block"
                    onLoad={() => setSelectedField(null)}
                  />
                  <canvas
                    ref={canvasRef}
                    aria-hidden="true"
                    className="absolute top-0 left-0 rounded-lg pointer-events-none"
                  />
                </div>
              ) : (
                <div className="text-on-surface-muted">
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
              <p className="text-sm text-on-surface-muted">
                Selected: <span className="font-medium text-on-surface">{imageFile.name}</span>
              </p>
            )}
          </div>

          {/* Application Data */}
          <div className="space-y-4">
            <h2
              className="text-base font-semibold text-on-surface"
              style={{ fontFamily: "var(--font-inter)" }}
            >
              Application Data
            </h2>
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
                <label className="block text-sm font-medium text-on-surface-dim mb-1">
                  {label}
                </label>
                <input
                  type="text"
                  value={fields[key]}
                  onChange={(e) => setFields({ ...fields, [key]: e.target.value })}
                  className="w-full border border-outline rounded-lg px-3 py-2 text-sm bg-surface-card text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                />
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium text-on-surface-dim mb-1">
                Government Warning Statement
              </label>
              <textarea
                rows={4}
                value={fields.governmentWarning}
                onChange={(e) => setFields({ ...fields, governmentWarning: e.target.value })}
                className="w-full border border-outline rounded-lg px-3 py-2 text-sm bg-surface-card text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={!imageFile || loading}
            className="bg-primary text-white font-semibold px-8 py-3 rounded-lg hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Verifying…" : "Verify Label"}
          </button>
          {loading && (
            <span className="text-on-surface-muted text-sm animate-pulse">
              Extracting label data…
            </span>
          )}
        </div>
      </form>

      {error && (
        <div className="mt-6 bg-bp-error-surface border border-bp-error-border text-bp-error rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {result && extracted && (
        <div className="mt-10 space-y-6">
          <div className="flex items-center gap-4">
            <h2
              className="text-xl font-bold text-on-surface"
              style={{ fontFamily: "var(--font-inter)" }}
            >
              Verification Results
            </h2>
            <span
              className={`px-4 py-1 rounded-full text-sm font-bold ${
                result.overallPass
                  ? "bg-bp-success-surface text-bp-success"
                  : "bg-bp-error-surface text-bp-error"
              }`}
            >
              {result.overallPass ? "PASSED" : "FAILED"}
            </span>
          </div>
          {boundingBoxes && (
            <p className="text-xs text-on-surface-muted">
              Click a field to highlight its location on the label.
            </p>
          )}
          <div className="space-y-3">
            {result.fields.map((field) => (
              <FieldRow
                key={field.field}
                field={field}
                confidence={confidence[field.field as keyof ConfidenceMap]}
                onClick={() => handleFieldClick(field.field)}
                isSelected={selectedField === field.field}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
