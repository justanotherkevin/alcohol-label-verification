"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

interface QueueSummary {
  id: string
  brandName: string
  applicant: string
  submittedAt: string
  status: "pending" | "analyzed" | "resolved"
  flagCount: number
  overallPass: boolean | null
}

const SETTINGS_KEY = "ttb-ocr-settings"

function verdictBadge(item: QueueSummary) {
  if (item.status === "pending") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-surface-dim text-on-surface-dim border border-outline">
        Awaiting analysis
      </span>
    )
  }
  if (item.flagCount === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-bp-success-surface text-bp-success border border-bp-success-border">
        Clean pass
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-bp-warning-surface text-bp-warning border border-bp-warning-border">
      {item.flagCount} flag{item.flagCount === 1 ? "" : "s"}
    </span>
  )
}

const PAGE_SIZE = 25

export default function DashboardPage() {
  const router = useRouter()
  const [items, setItems] = useState<QueueSummary[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [counts, setCounts] = useState({ pending: 0, flagged: 0, clean: 0 })
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [adding, setAdding] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [startingBatch, setStartingBatch] = useState(false)

  async function loadQueue(targetPage = page) {
    setLoading(true)
    const res = await fetch(`/api/queue?page=${targetPage}&pageSize=${PAGE_SIZE}`)
    const data = (await res.json()) as {
      items: QueueSummary[]
      total: number
      counts: { pending: number; flagged: number; clean: number }
    }
    setItems(data.items)
    setTotal(data.total)
    setCounts(data.counts)
    setPage(targetPage)
    setSelected(new Set())
    setLoading(false)
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function toggleSelectAll() {
    setSelected((prev) =>
      prev.size === items.length ? new Set() : new Set(items.map((item) => item.id))
    )
  }

  async function handleStartBatchReview() {
    const batchIds = items.filter((item) => selected.has(item.id)).map((item) => item.id)
    if (batchIds.length === 0) return

    setStartingBatch(true)
    const pendingIds = batchIds.filter((id) => {
      const item = items.find((i) => i.id === id)
      return item?.status === "pending"
    })

    if (pendingIds.length > 0) {
      let settings: { provider?: string; apiKey?: string } = {}
      try {
        settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") as typeof settings
      } catch { /* ignore malformed localStorage */ }
      await fetch("/api/queue/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Ocr-Provider": settings.provider ?? "mock",
          ...(settings.apiKey ? { "X-Api-Key": settings.apiKey } : {}),
        },
        body: JSON.stringify({ ids: pendingIds }),
      })
    }

    router.push(`/queue/${batchIds[0]}?batch=${batchIds.join(",")}`)
  }

  useEffect(() => {
    loadQueue(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleReset() {
    setResetting(true)
    await fetch("/api/queue/reset", { method: "DELETE" })
    await loadQueue(1)
    setResetting(false)
  }

  async function handleAddMock() {
    setAdding(true)
    await fetch("/api/queue", { method: "POST" })
    await loadQueue(1)
    setAdding(false)
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
    await loadQueue(page)
    setAnalyzing(false)
  }

  const { pending: pendingCount, flagged: flaggedCount, clean: cleanCount } = counts
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="px-8 py-8 max-w-7xl">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-on-surface" style={{ fontFamily: "var(--font-inter)" }}>
            Verification Queue
          </h1>
          <p className="text-sm text-on-surface-muted mt-1">
            TTB COLA applications awaiting specialist review — AI pre-analysis runs ahead of you.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            disabled={resetting}
            className="text-xs px-3 py-2 border border-outline rounded-lg text-on-surface-dim hover:bg-surface-dim transition-colors disabled:opacity-50"
          >
            {resetting ? "Resetting…" : "Reset seed data"}
          </button>
          <button
            onClick={handleAddMock}
            disabled={adding}
            className="text-xs px-3 py-2 border border-outline rounded-lg text-on-surface-dim hover:bg-surface-dim transition-colors disabled:opacity-50"
          >
            {adding ? "Adding…" : "+ Add mock application"}
          </button>
          <button
            onClick={handleAnalyze}
            disabled={analyzing || pendingCount === 0}
            className="text-xs px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50"
          >
            {analyzing ? "Analyzing…" : `Run pre-analysis now (${pendingCount} pending)`}
          </button>
          {selected.size > 0 && (
            <button
              onClick={handleStartBatchReview}
              disabled={startingBatch}
              className="text-xs px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50"
            >
              {startingBatch ? "Starting…" : `Start batch review (${selected.size})`}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-surface-card border border-outline rounded-2xl p-5">
          <p className="text-xs text-on-surface-muted font-medium uppercase tracking-wide">Awaiting analysis</p>
          <p className="text-3xl font-bold text-on-surface mt-1" style={{ fontFamily: "var(--font-inter)" }}>
            {pendingCount}
          </p>
        </div>
        <div className="bg-surface-card border border-outline rounded-2xl p-5">
          <p className="text-xs text-on-surface-muted font-medium uppercase tracking-wide">Flagged, needs review</p>
          <p className="text-3xl font-bold text-on-surface mt-1" style={{ fontFamily: "var(--font-inter)" }}>
            {flaggedCount}
          </p>
        </div>
        <div className="bg-surface-card border border-outline rounded-2xl p-5">
          <p className="text-xs text-on-surface-muted font-medium uppercase tracking-wide">Clean AI pass</p>
          <p className="text-3xl font-bold text-on-surface mt-1" style={{ fontFamily: "var(--font-inter)" }}>
            {cleanCount}
          </p>
        </div>
      </div>

      <div className="bg-surface-card border border-outline rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-outline">
          <h2 className="text-sm font-semibold text-on-surface" style={{ fontFamily: "var(--font-inter)" }}>
            Pending Applications
          </h2>
        </div>
        {loading ? (
          <p className="px-6 py-8 text-sm text-on-surface-muted">Loading queue…</p>
        ) : items.length === 0 ? (
          <p className="px-6 py-8 text-sm text-on-surface-muted">Queue is empty.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline bg-surface-dim">
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={items.length > 0 && selected.size === items.length}
                    onChange={toggleSelectAll}
                    aria-label="Select all applications on this page"
                  />
                </th>
                {["App ID", "Brand Name", "Applicant", "Submitted", "Verdict", "Action"].map((h) => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-on-surface-muted uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-surface-dim transition-colors">
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={selected.has(item.id)}
                      onChange={() => toggleSelected(item.id)}
                      aria-label={`Select ${item.id}`}
                    />
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-on-surface-dim">{item.id}</td>
                  <td className="px-6 py-4 text-sm font-medium text-on-surface">{item.brandName}</td>
                  <td className="px-6 py-4 text-sm text-on-surface-dim">{item.applicant}</td>
                  <td className="px-6 py-4 text-sm text-on-surface-muted">
                    {new Date(item.submittedAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">{verdictBadge(item)}</td>
                  <td className="px-6 py-4">
                    {item.status === "pending" ? (
                      <span className="text-xs text-on-surface-muted">Not yet analyzed</span>
                    ) : (
                      <Link
                        href={`/queue/${item.id}`}
                        className="text-xs font-medium text-primary hover:text-primary-hover transition-colors"
                      >
                        Review →
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && total > 0 && (
          <div className="px-6 py-3 border-t border-outline flex items-center justify-between">
            <p className="text-xs text-on-surface-muted">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => loadQueue(page - 1)}
                disabled={page <= 1}
                className="text-xs px-3 py-1.5 border border-outline rounded-lg text-on-surface-dim hover:bg-surface-dim transition-colors disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-xs text-on-surface-muted px-2 py-1.5">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => loadQueue(page + 1)}
                disabled={page >= totalPages}
                className="text-xs px-3 py-1.5 border border-outline rounded-lg text-on-surface-dim hover:bg-surface-dim transition-colors disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
