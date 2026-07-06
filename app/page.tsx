"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useIdentity } from "@/components/AppShell";
import ApplicantHome from "@/components/ApplicantHome";
import { Toast } from "@/components/Toast";

interface QueueSummary {
  id: string;
  brandName: string;
  applicant: string;
  submittedAt: string;
  status: "pending" | "analyzed" | "resolved";
  flagCount: number;
  overallPass: boolean | null;
}

interface BatchRun {
  id: number;
  analyzedCount: number;
  completedAt: string;
}

const SETTINGS_KEY = "ttb-ocr-settings";
const LAST_SEEN_BATCH_RUN_KEY = "ttb-last-seen-batch-run";

function verdictBadge(item: QueueSummary) {
  if (item.status === "pending") {
    return (
      <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold bg-surface-dim text-on-surface-dim border border-outline">
        Awaiting analysis
      </span>
    );
  }
  if (item.flagCount === 0) {
    return (
      <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold bg-bp-success-surface text-bp-success border border-bp-success-border">
        Clean pass
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold bg-bp-warning-surface text-bp-warning border border-bp-warning-border">
      {item.flagCount} flag{item.flagCount === 1 ? "" : "s"}
    </span>
  );
}

const PAGE_SIZE = 25;

export default function DashboardPage() {
  const { applicant } = useIdentity();
  const router = useRouter();
  const [items, setItems] = useState<QueueSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [counts, setCounts] = useState({ pending: 0, flagged: 0, clean: 0 });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [startingBatch, setStartingBatch] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  async function loadQueue(targetPage = page) {
    setLoading(true);
    const res = await fetch(
      `/api/queue?page=${targetPage}&pageSize=${PAGE_SIZE}`,
    );
    const data = (await res.json()) as {
      items: QueueSummary[];
      total: number;
      counts: { pending: number; flagged: number; clean: number };
      lastBatchRun: BatchRun | null;
    };
    setItems(data.items);
    setTotal(data.total);
    setCounts(data.counts);
    setPage(targetPage);
    setSelected(new Set());
    setLoading(false);

    if (data.lastBatchRun) {
      const lastSeenId = Number(
        localStorage.getItem(LAST_SEEN_BATCH_RUN_KEY) ?? "0",
      );
      if (data.lastBatchRun.id > lastSeenId) {
        setToastMessage(
          `Batch review completed — ${data.lastBatchRun.analyzedCount} application${data.lastBatchRun.analyzedCount === 1 ? "" : "s"} analyzed.`,
        );
        localStorage.setItem(
          LAST_SEEN_BATCH_RUN_KEY,
          String(data.lastBatchRun.id),
        );
      }
    }
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) =>
      prev.size === items.length ?
        new Set()
      : new Set(items.map((item) => item.id)),
    );
  }

  async function handleStartBatchReview() {
    const batchIds = items
      .filter((item) => selected.has(item.id))
      .map((item) => item.id);
    if (batchIds.length === 0) return;

    setStartingBatch(true);
    const pendingIds = batchIds.filter((id) => {
      const item = items.find((i) => i.id === id);
      return item?.status === "pending";
    });

    if (pendingIds.length > 0) {
      let settings: { provider?: string; apiKey?: string } = {};
      try {
        settings = JSON.parse(
          localStorage.getItem(SETTINGS_KEY) ?? "{}",
        ) as typeof settings;
      } catch {
        /* ignore malformed localStorage */
      }
      await fetch("/api/queue/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Ocr-Provider": settings.provider ?? "mock",
          ...(settings.apiKey ? { "X-Api-Key": settings.apiKey } : {}),
        },
        body: JSON.stringify({ ids: pendingIds }),
      });
    }

    router.push(`/queue/${batchIds[0]}?batch=${batchIds.join(",")}`);
  }

  useEffect(() => {
    if (!applicant) loadQueue(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicant]);

  const {
    pending: pendingCount,
    flagged: flaggedCount,
    clean: cleanCount,
  } = counts;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (applicant) {
    return <ApplicantHome applicantName={applicant.name} />;
  }

  return (
    <div className="px-8 py-8 max-w-7xl">
      {toastMessage && (
        <Toast
          message={toastMessage}
          onDismiss={() => setToastMessage(null)}
        />
      )}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1
            className="text-3xl font-bold text-on-surface"
            style={{ fontFamily: "var(--font-inter)" }}>
            Verification Queue
          </h1>
          <p className="text-base text-on-surface-muted mt-2">
            TTB COLA applications awaiting specialist review — AI pre-analysis
            runs ahead of you.
          </p>
        </div>
        <div className="flex gap-3">
          {selected.size > 0 && (
            <button
              onClick={handleStartBatchReview}
              disabled={startingBatch}
              className="px-5 py-3 text-base font-semibold bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus:outline-2 focus:outline-offset-2 focus:outline-primary whitespace-nowrap">
              {startingBatch ?
                "Starting…"
              : `Start batch review (${selected.size})`}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-surface-card border border-outline rounded-2xl p-6">
          <p className="text-sm text-on-surface-muted font-medium uppercase tracking-wide">
            Awaiting analysis
          </p>
          <p
            className="text-4xl font-bold text-on-surface mt-3"
            style={{ fontFamily: "var(--font-inter)" }}>
            {pendingCount}
          </p>
        </div>
        <div className="bg-surface-card border border-outline rounded-2xl p-6">
          <p className="text-sm text-on-surface-muted font-medium uppercase tracking-wide">
            Flagged, needs review
          </p>
          <p
            className="text-4xl font-bold text-on-surface mt-3"
            style={{ fontFamily: "var(--font-inter)" }}>
            {flaggedCount}
          </p>
        </div>
        <div className="bg-surface-card border border-outline rounded-2xl p-6">
          <p className="text-sm text-on-surface-muted font-medium uppercase tracking-wide">
            Clean AI pass
          </p>
          <p
            className="text-4xl font-bold text-on-surface mt-3"
            style={{ fontFamily: "var(--font-inter)" }}>
            {cleanCount}
          </p>
        </div>
      </div>

      <div className="bg-surface-card border border-outline rounded-2xl overflow-hidden flex flex-col">
        <div className="px-6 py-5 border-b border-outline">
          <h2
            className="text-lg font-semibold text-on-surface"
            style={{ fontFamily: "var(--font-inter)" }}>
            Pending Applications
          </h2>
        </div>
        {loading ?
          <p className="px-6 py-8 text-base text-on-surface-muted">
            Loading queue…
          </p>
        : items.length === 0 ?
          <p className="px-6 py-8 text-base text-on-surface-muted">
            Queue is empty.
          </p>
        : <div className="flex-1 overflow-x-auto">
            <table className="w-full text-base min-w-max">
              <thead>
                <tr className="border-b border-outline bg-surface-dim">
                  <th className="px-6 py-4 text-left w-12">
                    <input
                      type="checkbox"
                      checked={
                        items.length > 0 && selected.size === items.length
                      }
                      onChange={toggleSelectAll}
                      aria-label="Select all applications on this page"
                      className="w-5 h-5 cursor-pointer"
                    />
                  </th>
                  {[
                    "App ID",
                    "Brand Name",
                    "Applicant",
                    "Submitted",
                    "Verdict",
                    "Action",
                  ].map((h) => (
                    <th
                      key={h}
                      className={`px-6 py-4 ${["App ID", "Submitted"].includes(h) ? "w-3" : ""} text-left text-sm font-semibold text-on-surface-muted uppercase tracking-wider`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline">
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-surface-dim transition-colors">
                    <td className="px-6 py-5">
                      <input
                        type="checkbox"
                        checked={selected.has(item.id)}
                        onChange={() => toggleSelected(item.id)}
                        aria-label={`Select ${item.id}`}
                        className="w-5 h-5 cursor-pointer"
                      />
                    </td>
                    <td className="px-6 py-5 font-mono text-sm text-on-surface-dim">
                      {item.id}
                    </td>
                    <td className="px-6 py-5 text-base font-medium text-on-surface">
                      {item.brandName}
                    </td>
                    <td className="px-6 py-5 text-base text-on-surface-dim">
                      {item.applicant}
                    </td>
                    <td className="px-6 py-5 text-base text-on-surface-muted">
                      {new Date(item.submittedAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-5">{verdictBadge(item)}</td>
                    <td className="px-6 py-5">
                      {item.status === "pending" ?
                        <span className="text-base text-on-surface-muted">
                          Not yet analyzed
                        </span>
                      : <button
                          onClick={() =>
                            (window.location.href = `/queue/${item.id}`)
                          }
                          className="px-4 py-2 text-base font-semibold bg-surface-dim text-on-surface hover:bg-outline transition-colors rounded-lg cursor-pointer focus:outline-2 focus:outline-offset-2 focus:outline-primary">
                          Review
                        </button>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        }
        {!loading && total > 0 && (
          <div className="px-6 py-4 border-t border-outline flex items-center justify-between">
            <p className="text-base text-on-surface-muted">
              Showing {(page - 1) * PAGE_SIZE + 1}–
              {Math.min(page * PAGE_SIZE, total)} of {total}
            </p>
            <div className="flex gap-3 items-center">
              <button
                onClick={() => loadQueue(page - 1)}
                disabled={page <= 1}
                className="text-base px-4 py-2.5 border-2 border-outline rounded-lg text-on-surface-dim hover:bg-surface-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer font-semibold focus:outline-2 focus:outline-offset-2 focus:outline-primary">
                Previous
              </button>
              <span className="text-base text-on-surface-muted px-3">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => loadQueue(page + 1)}
                disabled={page >= totalPages}
                className="text-base px-4 py-2.5 border-2 border-outline rounded-lg text-on-surface-dim hover:bg-surface-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer font-semibold focus:outline-2 focus:outline-offset-2 focus:outline-primary">
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
