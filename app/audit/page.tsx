"use client"

import { useEffect, useState } from "react"
import { AuditEntry } from "@/lib/queue/specialist"

const SUMMARY = [
  { icon: "assignment_turned_in", label: "Total Reviews",   value: "1,284" },
  { icon: "verified",             label: "Compliance Rate", value: "94.2%" },
  { icon: "gavel",                label: "Revocations",     value: "42" },
  { icon: "timer",                label: "Avg Response",    value: "4.2h" },
]

const STATUS_BADGE: Record<string, string> = {
  Compliant: "bg-bp-success-surface text-bp-success border border-bp-success-border",
  Violation: "bg-bp-error-surface text-bp-error border border-bp-error-border",
  Flagged:   "bg-bp-warning-surface text-bp-warning border border-bp-warning-border",
}

const TIMELINE = [
  { icon: "edit",    color: "text-primary",    text: "Label TTB-2024-8831 updated",        time: "5m ago" },
  { icon: "warning", color: "text-bp-error",   text: "Violation flagged on TTB-2024-8829", time: "52m ago" },
  { icon: "upload",  color: "text-secondary",  text: "Batch of 12 labels submitted",       time: "2h ago" },
  { icon: "check",   color: "text-bp-success", text: "TTB-2024-8828 approved",             time: "3h ago" },
]

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/audit")
      .then((res) => res.json())
      .then((data: { entries: AuditEntry[] }) => {
        setEntries(data.entries)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

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

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {SUMMARY.map(({ icon, label, value }) => (
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
                {["ID", "Timestamp", "Product", "Specialist", "Status"].map((h) => (
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
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-on-surface-muted">
                    Loading…
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-on-surface-muted">
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
          <div className="space-y-4">
            {TIMELINE.map(({ icon, color, text, time }) => (
              <div key={text} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-surface-dim flex items-center justify-center shrink-0">
                  <span className={`material-symbols-outlined text-[18px] ${color}`}>{icon}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-on-surface">{text}</p>
                  <p className="text-xs text-on-surface-muted mt-0.5">{time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
