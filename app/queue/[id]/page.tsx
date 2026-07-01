"use client"

import { useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { FieldResult, VerificationResult } from "@/lib/verify"
import { BoundingBoxMap, ConfidenceMap } from "@/lib/ocr/types"

interface QueueApplicationDetail {
  id: string
  brandName: string
  applicant: string
  submittedAt: string
  imageBase64: string
  imageMimeType: string
  status: "pending" | "analyzed" | "resolved"
  analysis: {
    confidence: ConfidenceMap
    boundingBoxes?: BoundingBoxMap
    result: VerificationResult
  } | null
}

function StatusBadge({ status }: { status: FieldResult["status"] }) {
  if (status === "pass") return <span className="text-bp-success font-bold text-lg">✓</span>
  if (status === "fail") return <span className="text-bp-error font-bold text-lg">✗</span>
  return <span className="text-bp-warning font-bold text-lg">—</span>
}

export default function QueueDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [app, setApp] = useState<QueueApplicationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedField, setSelectedField] = useState<string | null>(null)
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const [overrideDraftField, setOverrideDraftField] = useState<string | null>(null)
  const [overrideReason, setOverrideReason] = useState("")
  const [rejectMode, setRejectMode] = useState(false)
  const [rejectedFields, setRejectedFields] = useState<string[]>([])
  const [rejectNote, setRejectNote] = useState("")
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    fetch(`/api/queue/${params.id}`)
      .then((res) => res.json())
      .then((data: { application: QueueApplicationDetail }) => {
        setApp(data.application)
        setLoading(false)
      })
  }, [params.id])

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
    if (!selectedField || !app?.analysis?.boundingBoxes) return
    const bbox = app.analysis.boundingBoxes[selectedField as keyof BoundingBoxMap]
    if (!bbox) return
    ctx.strokeStyle = "#4c6080"
    ctx.lineWidth = 2
    ctx.fillStyle = "rgba(76, 96, 128, 0.12)"
    ctx.beginPath()
    ctx.rect(bbox.x * w, bbox.y * h, bbox.width * w, bbox.height * h)
    ctx.fill()
    ctx.stroke()
  }, [selectedField, app])

  function handleFieldClick(fieldKey: string) {
    setSelectedField((prev) => (prev === fieldKey ? null : fieldKey))
  }

  function openOverride(fieldKey: string) {
    setOverrideDraftField(fieldKey)
    setOverrideReason(overrides[fieldKey] ?? "")
  }

  function saveOverride() {
    if (!overrideDraftField || !overrideReason.trim()) return
    setOverrides((prev) => ({ ...prev, [overrideDraftField]: overrideReason.trim() }))
    // Keep the reject checkbox list in sync: a field that's now overridden is no
    // longer "still flagged", so it must not remain cited for rejection.
    setRejectedFields((prev) => prev.filter((f) => f !== overrideDraftField))
    setOverrideDraftField(null)
    setOverrideReason("")
  }

  function clearOverride(fieldKey: string) {
    setOverrides((prev) => {
      const next = { ...prev }
      delete next[fieldKey]
      return next
    })
  }

  function toggleRejectedField(fieldKey: string) {
    setRejectedFields((prev) => (prev.includes(fieldKey) ? prev.filter((f) => f !== fieldKey) : [...prev, fieldKey]))
  }

  const flaggedFields = app?.analysis?.result.fields.filter((f) => f.status !== "pass") ?? []
  const stillFlagged = flaggedFields.filter((f) => !overrides[f.field])
  const canApprove = app?.analysis !== null && stillFlagged.length === 0
  // Only count citations that are still actually flagged — guards against any
  // drift between `rejectedFields` and `stillFlagged` when deciding whether the
  // Confirm Reject button should be enabled.
  const validRejectedFieldCount = rejectedFields.filter((f) => stillFlagged.some((sf) => sf.field === f)).length

  async function submitResolution(decision: "approved" | "rejected") {
    if (!app) return
    setSubmitError(null)
    setSubmitting(true)
    // Defense-in-depth: only ever submit rejected-field citations that are still
    // actually flagged (not since overridden), even if state somehow drifted.
    const stillFlaggedKeys = new Set(stillFlagged.map((f) => f.field))
    const validRejectedFields = rejectedFields.filter((f) => stillFlaggedKeys.has(f))
    const body = {
      decision,
      overrides: Object.entries(overrides).map(([field, reason]) => ({ field, reason })),
      rejectedFields: decision === "rejected" ? validRejectedFields : [],
      note: decision === "rejected" ? rejectNote : "",
    }
    const res = await fetch(`/api/queue/${app.id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const data = (await res.json()) as { error: string }
      setSubmitError(data.error)
      setSubmitting(false)
      return
    }
    router.push("/")
  }

  if (loading) return <div className="px-8 py-8 text-sm text-on-surface-muted">Loading application…</div>
  if (!app) return <div className="px-8 py-8 text-sm text-bp-error">Application not found.</div>

  return (
    <div className="px-8 py-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-on-surface" style={{ fontFamily: "var(--font-inter)" }}>
          {app.brandName}
        </h1>
        <p className="text-sm text-on-surface-muted mt-1">
          {app.id} · {app.applicant} · submitted {new Date(app.submittedAt).toLocaleString()}
        </p>
      </div>

      {!app.analysis ? (
        <p className="text-sm text-on-surface-muted">
          This application has not been analyzed yet. Run pre-analysis from the queue screen first.
        </p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <div className="relative inline-block">
              <img
                ref={imgRef}
                src={`data:${app.imageMimeType};base64,${app.imageBase64}`}
                alt="Label"
                className="max-h-96 rounded-lg object-contain block border border-outline"
              />
              <canvas ref={canvasRef} aria-hidden="true" className="absolute top-0 left-0 rounded-lg pointer-events-none" />
            </div>
            {app.analysis.boundingBoxes && (
              <p className="text-xs text-on-surface-muted mt-2">Click a field to highlight its location on the label.</p>
            )}
          </div>

          <div className="space-y-3">
            {app.analysis.result.fields.map((f) => {
              const isOverridden = Boolean(overrides[f.field])
              const bgColor =
                f.status === "pass" || isOverridden
                  ? "bg-bp-success-surface border-bp-success-border"
                  : f.status === "fail"
                    ? "bg-bp-error-surface border-bp-error-border"
                    : "bg-bp-warning-surface border-bp-warning-border"
              return (
                <div
                  key={f.field}
                  data-testid={`field-row-${f.field}`}
                  className={`border rounded-lg p-4 ${bgColor} cursor-pointer ${selectedField === f.field ? "ring-2 ring-primary" : ""}`}
                  onClick={() => handleFieldClick(f.field)}
                >
                  <div className="flex items-start gap-3">
                    <StatusBadge status={isOverridden ? "pass" : f.status} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-on-surface">
                        {f.label} {isOverridden && <span className="text-xs font-normal text-bp-success">(Overridden)</span>}
                      </p>
                      {f.status !== "pass" && !isOverridden && (
                        <div className="mt-1 text-sm space-y-1">
                          <p className="text-on-surface-dim">
                            <span className="font-medium">Expected:</span>{" "}
                            <span className="font-mono">{f.expected ?? "—"}</span>
                          </p>
                          <p className="text-bp-error">
                            <span className="font-medium">Found on label:</span>{" "}
                            <span className="font-mono">{f.extracted ?? "not found"}</span>
                          </p>
                          {f.note && <p className="text-on-surface-muted italic text-xs mt-1">{f.note}</p>}
                        </div>
                      )}
                      {isOverridden && (
                        <p className="text-xs text-on-surface-muted mt-1 italic">Reason: {overrides[f.field]}</p>
                      )}
                      {f.status === "pass" && !isOverridden && (
                        <p className="text-sm text-on-surface-dim mt-1 font-mono">{f.extracted}</p>
                      )}
                      {f.status !== "pass" && (
                        <div className="mt-2 flex gap-2" onClick={(e) => e.stopPropagation()}>
                          {isOverridden ? (
                            <button
                              onClick={() => clearOverride(f.field)}
                              className="text-xs font-medium text-on-surface-dim hover:text-on-surface underline"
                            >
                              Remove override
                            </button>
                          ) : (
                            <button
                              onClick={() => openOverride(f.field)}
                              className="text-xs font-medium text-primary hover:text-primary-hover underline"
                            >
                              Override
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {overrideDraftField && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={() => setOverrideDraftField(null)}
        >
          <div className="bg-surface-card rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-on-surface mb-3">Override field</h3>
            <textarea
              rows={3}
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="Reason for overriding this mismatch…"
              className="w-full border border-outline rounded-lg px-3 py-2 text-sm bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setOverrideDraftField(null)}
                className="text-xs px-3 py-2 border border-outline rounded-lg text-on-surface-dim"
              >
                Cancel
              </button>
              <button
                onClick={saveOverride}
                disabled={!overrideReason.trim()}
                className="text-xs px-3 py-2 bg-primary text-white rounded-lg disabled:opacity-50"
              >
                Save override
              </button>
            </div>
          </div>
        </div>
      )}

      {app.analysis && app.status !== "resolved" && (
        <div className="mt-8 border-t border-outline pt-6">
          {submitError && (
            <div className="mb-4 bg-bp-error-surface border border-bp-error-border text-bp-error rounded-lg px-4 py-3 text-sm">
              {submitError}
            </div>
          )}

          {!rejectMode ? (
            <div className="flex gap-3">
              <button
                onClick={() => submitResolution("approved")}
                disabled={!canApprove || submitting}
                className="px-5 py-2.5 bg-bp-success text-white text-sm font-semibold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Approve
              </button>
              <button
                onClick={() => setRejectMode(true)}
                disabled={stillFlagged.length === 0 || submitting}
                className="px-5 py-2.5 border border-bp-error text-bp-error text-sm font-semibold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Reject
              </button>
              {!canApprove && (
                <p className="text-xs text-on-surface-muted self-center">
                  {stillFlagged.length} field(s) still flagged — override or reject them first.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium text-on-surface">Select the field(s) that justify rejection:</p>
              <div className="space-y-1">
                {stillFlagged.map((f) => (
                  <label key={f.field} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={rejectedFields.includes(f.field)} onChange={() => toggleRejectedField(f.field)} />
                    {f.label}
                  </label>
                ))}
              </div>
              <textarea
                rows={2}
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder="Rejection note (required)…"
                className="w-full border border-outline rounded-lg px-3 py-2 text-sm bg-surface-card text-on-surface"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => submitResolution("rejected")}
                  disabled={validRejectedFieldCount === 0 || !rejectNote.trim() || submitting}
                  className="px-5 py-2.5 bg-bp-error text-white text-sm font-semibold rounded-lg disabled:opacity-40"
                >
                  Confirm Reject
                </button>
                <button
                  onClick={() => setRejectMode(false)}
                  className="px-5 py-2.5 border border-outline text-on-surface-dim text-sm font-semibold rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
