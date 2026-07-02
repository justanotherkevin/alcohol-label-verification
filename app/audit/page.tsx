"use client"

import { useCallback, useEffect, useState } from "react"
import { AuditEntry } from "@/lib/queue/specialist"
import { ActivityItem, AuditSummary, formatTimeAgo } from "@/lib/queue/audit-types"
import { RevertConfirmModal } from "@/components/queue/RevertConfirmModal"

const STATUS_BADGE: Record<string, string> = {
  Compliant: "bg-bp-success-surface text-bp-success border border-bp-success-border",
  Violation: "bg-bp-error-surface text-bp-error border border-bp-error-border",
  Flagged:   "bg-bp-warning-surface text-bp-warning border border-bp-warning-border",
}

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [summary, setSummary] = useState<AuditSummary | null>(null)
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [revertTargetId, setRevertTargetId] = useState<string | null>(null)
  const [reverting, setReverting] = useState(false)
  const [revertError, setRevertError] = useState<string | null>(null)

  const loadAudit = useCallback(() => {
    return fetch("/api/audit")
      .then((res) => res.json())
      .then((data: { entries: AuditEntry[]; summary: AuditSummary; activity: ActivityItem[] }) => {
        setEntries(data.entries)
        setSummary(data.summary)
        setActivity(data.activity)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadAudit()
  }, [loadAudit])

  async function handleRevert() {
    if (!revertTargetId) return
    setReverting(true)
    setRevertError(null)
    try {
      const res = await fetch(`/api/queue/${revertTargetId}/revert`, { method: "POST" })
      if (!res.ok) {
        const data = (await res.json()) as { error: string }
        throw new Error(data.error)
      }
      setRevertTargetId(null)
      await loadAudit()
    } catch (e) {
      setRevertError(e instanceof Error ? e.message : "Unknown error")
    } finally {
      setReverting(false)
    }
  }

  const summaryCards = summary
    ? [
        { icon: "assignment_turned_in", label: "Total Reviews",   value: String(summary.totalReviews) },
        { icon: "verified",             label: "Compliance Rate", value: `${summary.complianceRate}%` },
        { icon: "gavel",                label: "Rejections",      value: String(summary.rejectedCount) },
        { icon: "timer",                label: "Avg Response",    value: `${summary.avgResponseHours}h` },
      ]
    : []

  return (
    <div className="px-8 py-8 max-w-7xl">
      <div className="mb-8">
        <h1
          className="text-2xl font-bold text-on-surface"
          style={{ fontFamily: "var(--font-inter)" }}
        >
          Verification Audit Log
        </h1>
        <p className="text-sm text-on-surface-muted mt-1">
          Historical record of all COLA compliance reviews
        </p>
      </div>

      {revertError && (
        <div className="mb-6 bg-bp-error-surface border border-bp-error-border text-bp-error rounded-lg px-4 py-3 text-sm">
          {revertError}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {summaryCards.map(({ icon, label, value }) => (
          <div
            key={label}
            className="bg-surface-card border border-outline rounded-2xl p-5 flex items-center gap-4"
          >
            <span className="material-symbols-outlined text-primary text-2xl">{icon}</span>
            <div>
              <p className="text-xs text-on-surface-muted uppercase tracking-wide">{label}</p>
              <p
                className="text-xl font-bold text-on-surface"
                style={{ fontFamily: "var(--font-inter)" }}
              >
                {value}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Main table */}
        <div className="col-span-12 lg:col-span-8 bg-surface-card border border-outline rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-outline">
            <h2
              className="text-sm font-semibold text-on-surface"
              style={{ fontFamily: "var(--font-inter)" }}
            >
              Review History
            </h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-dim border-b border-outline">
                {["ID", "Timestamp", "Product", "Specialist", "Status", "Actions"].map((h) => (
                  <th
                    key={h}
                    className="px-6 py-3 text-left text-xs font-semibold text-on-surface-muted uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-on-surface-muted">
                    Loading…
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-on-surface-muted">
                    No completed reviews yet. Approve or reject an application from the queue to see it here.
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-surface-dim transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-on-surface-dim">{entry.id}</td>
                    <td className="px-6 py-4 text-xs text-on-surface-muted">{entry.timestamp}</td>
                    <td className="px-6 py-4 text-sm font-medium text-on-surface">{entry.product}</td>
                    <td className="px-6 py-4 text-sm text-on-surface-dim">{entry.specialist}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[entry.status]}`}
                      >
                        {entry.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => setRevertTargetId(entry.id)}
                        className="text-xs px-3 py-1.5 border border-outline text-on-surface-dim font-semibold rounded-lg"
                      >
                        Revert
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {!loading && entries.length > 0 && (
            <div className="px-6 py-3 border-t border-outline">
              <p className="text-xs text-on-surface-muted">
                Showing {entries.length} completed review{entries.length !== 1 ? "s" : ""}
              </p>
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="col-span-12 lg:col-span-4 bg-surface-card border border-outline rounded-2xl p-6">
          <h2
            className="text-sm font-semibold text-on-surface mb-4"
            style={{ fontFamily: "var(--font-inter)" }}
          >
            Recent Activity
          </h2>
          {!loading && activity.length === 0 ? (
            <p className="text-sm text-on-surface-muted">No recent activity yet.</p>
          ) : (
            <div className="space-y-4">
              {activity.map(({ id, icon, color, text, timestamp }) => (
                <div key={id} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-surface-dim flex items-center justify-center shrink-0">
                    <span className={`material-symbols-outlined text-[18px] ${color}`}>{icon}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-on-surface">{text}</p>
                    <p className="text-xs text-on-surface-muted mt-0.5">{formatTimeAgo(timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <RevertConfirmModal
        open={revertTargetId !== null}
        submitting={reverting}
        onConfirm={handleRevert}
        onClose={() => setRevertTargetId(null)}
      />
    </div>
  )
}
