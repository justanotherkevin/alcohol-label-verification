"use client";

import { useCallback, useEffect, useState } from "react";
import { AuditEntry } from "@/lib/queue/specialist";
import {
  ActivityItem,
  AuditSummary,
  formatTimeAgo,
} from "@/lib/queue/audit-types";
import { RevertConfirmModal } from "@/components/queue/RevertConfirmModal";

const STATUS_BADGE: Record<string, string> = {
  Compliant:
    "bg-bp-success-surface text-bp-success border border-bp-success-border",
  Violation: "bg-bp-error-surface text-bp-error border border-bp-error-border",
  Flagged:
    "bg-bp-warning-surface text-bp-warning border border-bp-warning-border",
};

const PAGE_SIZE = 25;

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [revertTargetId, setRevertTargetId] = useState<string | null>(null);
  const [reverting, setReverting] = useState(false);
  const [revertError, setRevertError] = useState<string | null>(null);

  const loadAudit = useCallback((targetPage = page) => {
    setLoading(true);
    return fetch(`/api/audit?page=${targetPage}&pageSize=${PAGE_SIZE}`)
      .then((res) => res.json())
      .then(
        (data: {
          entries: AuditEntry[];
          total: number;
          summary: AuditSummary;
          activity: ActivityItem[];
        }) => {
          setEntries(data.entries);
          setTotal(data.total);
          setPage(targetPage);
          setSummary(data.summary);
          setActivity(data.activity);
          setLoading(false);
        },
      )
      .catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadAudit(1);
  }, [loadAudit]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function handleRevert() {
    if (!revertTargetId) return;
    setReverting(true);
    setRevertError(null);
    try {
      const res = await fetch(`/api/queue/${revertTargetId}/revert`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = (await res.json()) as { error: string };
        throw new Error(data.error);
      }
      setRevertTargetId(null);
      await loadAudit(page);
    } catch (e) {
      setRevertError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setReverting(false);
    }
  }

  const summaryCards =
    summary ?
      [
        {
          icon: "assignment_turned_in",
          label: "Total Reviews",
          value: String(summary.totalReviews),
        },
        {
          icon: "verified",
          label: "Compliance Rate",
          value: `${summary.complianceRate}%`,
        },
        {
          icon: "gavel",
          label: "Rejections",
          value: String(summary.rejectedCount),
        },
        {
          icon: "timer",
          label: "Avg Response",
          value: `${summary.avgResponseHours}h`,
        },
      ]
    : [];

  return (
    <div className="px-8 py-8 max-w-7xl">
      <div className="mb-8">
        <h1
          className="text-3xl font-bold text-on-surface"
          style={{ fontFamily: "var(--font-inter)" }}>
          Verification Audit Log
        </h1>
        <p className="text-base text-on-surface-muted mt-2">
          Historical record of all COLA compliance reviews
        </p>
      </div>

      {revertError && (
        <div className="mb-6 bg-bp-error-surface border border-bp-error-border text-bp-error rounded-lg px-5 py-4 text-base font-semibold">
          {revertError}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {summaryCards.map(({ icon, label, value }) => (
          <div
            key={label}
            className="bg-surface-card border border-outline rounded-2xl p-6 flex items-center gap-4">
            <span className="material-symbols-outlined text-primary text-3xl">
              {icon}
            </span>
            <div>
              <p className="text-sm text-on-surface-muted uppercase tracking-wide">
                {label}
              </p>
              <p
                className="text-2xl font-bold text-on-surface"
                style={{ fontFamily: "var(--font-inter)" }}>
                {value}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Main table */}
        <div className="col-span-12 xl:col-span-8 bg-surface-card border border-outline rounded-2xl overflow-hidden flex flex-col">
          <div className="px-6 py-5 border-b border-outline">
            <h2
              className="text-lg font-semibold text-on-surface"
              style={{ fontFamily: "var(--font-inter)" }}>
              Review History
            </h2>
          </div>
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-base min-w-max">
              <thead>
                <tr className="bg-surface-dim border-b border-outline">
                  {[
                    "ID",
                    "Timestamp",
                    "Product",
                    "Specialist",
                    "Status",
                    "Actions",
                  ].map((h) => (
                    <th
                      key={h}
                      className={`px-6 py-4 ${["ID", "Timestamp"].includes(h) ? "w-3" : ""} text-left text-sm font-semibold text-on-surface-muted uppercase tracking-wider`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline">
                {loading ?
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-8 text-center text-base text-on-surface-muted">
                      Loading…
                    </td>
                  </tr>
                : entries.length === 0 ?
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-8 text-center text-base text-on-surface-muted">
                      No completed reviews yet. Approve or reject an application
                      from the queue to see it here.
                    </td>
                  </tr>
                : entries.map((entry) => (
                    <tr
                      key={entry.id}
                      className="hover:bg-surface-dim transition-colors">
                      <td className="px-6 py-5 font-mono text-sm text-on-surface-dim">
                        {entry.id}
                      </td>
                      <td className="px-6 py-5 text-sm text-on-surface-muted">
                        {entry.timestamp}
                      </td>
                      <td className="px-6 py-5 text-base font-medium text-on-surface">
                        {entry.product}
                      </td>
                      <td className="px-6 py-5 text-base text-on-surface-dim">
                        {entry.specialist}
                      </td>
                      <td className="px-6 py-5">
                        <span
                          className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold ${STATUS_BADGE[entry.status]}`}>
                          {entry.status}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <button
                          onClick={() => setRevertTargetId(entry.id)}
                          className="text-base px-4 py-2 border-2 border-outline text-on-surface-dim font-semibold rounded-lg cursor-pointer hover:bg-surface-dim transition-colors focus:outline-2 focus:outline-offset-2 focus:outline-primary">
                          Revert
                        </button>
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
          {!loading && total > 0 && (
            <div className="px-6 py-4 border-t border-outline flex items-center justify-between">
              <p className="text-base text-on-surface-muted">
                Showing {(page - 1) * PAGE_SIZE + 1}–
                {Math.min(page * PAGE_SIZE, total)} of {total}
              </p>
              <div className="flex gap-3 items-center">
                <button
                  onClick={() => loadAudit(page - 1)}
                  disabled={page <= 1}
                  className="text-base px-4 py-2.5 border-2 border-outline rounded-lg text-on-surface-dim hover:bg-surface-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer font-semibold focus:outline-2 focus:outline-offset-2 focus:outline-primary">
                  Previous
                </button>
                <span className="text-base text-on-surface-muted px-3">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => loadAudit(page + 1)}
                  disabled={page >= totalPages}
                  className="text-base px-4 py-2.5 border-2 border-outline rounded-lg text-on-surface-dim hover:bg-surface-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer font-semibold focus:outline-2 focus:outline-offset-2 focus:outline-primary">
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="col-span-12 xl:col-span-4 bg-surface-card border border-outline rounded-2xl p-6">
          <h2
            className="text-lg font-semibold text-on-surface mb-5"
            style={{ fontFamily: "var(--font-inter)" }}>
            Recent Activity
          </h2>
          {!loading && activity.length === 0 ?
            <p className="text-base text-on-surface-muted">
              No recent activity yet.
            </p>
          : <div className="space-y-5">
              {activity.map(({ id, icon, color, text, timestamp }) => (
                <div key={id} className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-surface-dim flex items-center justify-center shrink-0">
                    <span
                      className={`material-symbols-outlined text-[20px] ${color}`}>
                      {icon}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-base text-on-surface font-medium">
                      {text}
                    </p>
                    <p className="text-sm text-on-surface-muted mt-1">
                      {formatTimeAgo(timestamp)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          }
        </div>
      </div>

      <RevertConfirmModal
        open={revertTargetId !== null}
        submitting={reverting}
        onConfirm={handleRevert}
        onClose={() => setRevertTargetId(null)}
      />
    </div>
  );
}
