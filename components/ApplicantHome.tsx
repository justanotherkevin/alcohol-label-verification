"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface QueueSummary {
  id: string;
  brandName: string;
  applicant: string;
  submittedAt: string;
  status: "pending" | "analyzed" | "resolved";
  flagCount: number;
  overallPass: boolean | null;
}

function statusBadge(item: QueueSummary) {
  if (item.status === "pending") {
    return (
      <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-semibold bg-surface-dim text-on-surface-dim border border-outline">
        <span className="material-symbols-outlined text-[16px]">schedule</span>
        Waiting for reviewer
      </span>
    );
  }
  if (item.status === "resolved") {
    return (
      <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-semibold bg-bp-success-surface text-bp-success border border-bp-success-border">
        <span className="material-symbols-outlined text-[16px]">check_circle</span>
        Resolved
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-semibold bg-bp-warning-surface text-bp-warning border border-bp-warning-border">
      <span className="material-symbols-outlined text-[16px]">visibility</span>
      Under review
    </span>
  );
}

export default function ApplicantHome({
  applicantName,
}: {
  applicantName: string;
}) {
  const [items, setItems] = useState<QueueSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(
      `/api/queue?applicant=${encodeURIComponent(applicantName)}&pageSize=100`,
    )
      .then((res) => res.json())
      .then((data: { items: QueueSummary[] }) => setItems(data.items))
      .finally(() => setLoading(false));
  }, [applicantName]);

  const pendingCount = items.filter((i) => i.status !== "resolved").length;
  const resolvedCount = items.filter((i) => i.status === "resolved").length;

  return (
    <div className="min-h-screen max-w-5xl p-8 mx-auto">
      <div className="mb-8 flex items-start justify-between gap-6">
        <div>
          <h1
            className="text-3xl font-bold text-on-surface"
            style={{ fontFamily: "var(--font-inter)" }}>
            My Applications
          </h1>
          <p className="text-base text-on-surface-muted mt-2">
            COLA applications submitted by {applicantName}.
          </p>
        </div>
        <Link
          href="/apply"
          className="flex items-center gap-2 px-5 py-3 text-base font-semibold bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors cursor-pointer focus:outline-2 focus:outline-offset-2 focus:outline-primary whitespace-nowrap shadow-sm">
          <span className="material-symbols-outlined text-xl">add</span>
          Submit a new application
        </Link>
      </div>

      {!loading && items.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-surface-card border border-outline rounded-xl p-5">
            <p className="text-sm font-semibold text-on-surface-muted uppercase tracking-wide mb-1">
              Total
            </p>
            <p className="text-2xl font-bold text-on-surface">{items.length}</p>
          </div>
          <div className="bg-surface-card border border-outline rounded-xl p-5">
            <p className="text-sm font-semibold text-on-surface-muted uppercase tracking-wide mb-1">
              In review
            </p>
            <p className="text-2xl font-bold text-bp-warning">{pendingCount}</p>
          </div>
          <div className="bg-surface-card border border-outline rounded-xl p-5">
            <p className="text-sm font-semibold text-on-surface-muted uppercase tracking-wide mb-1">
              Resolved
            </p>
            <p className="text-2xl font-bold text-bp-success">{resolvedCount}</p>
          </div>
        </div>
      )}

      <div className="bg-surface-card border border-outline rounded-2xl overflow-hidden flex flex-col shadow-sm">
        {loading ?
          <div className="px-6 py-16 text-center">
            <p className="text-base text-on-surface-muted">Loading applications…</p>
          </div>
        : items.length === 0 ?
          <div className="px-6 py-16 text-center">
            <span className="material-symbols-outlined text-on-surface-muted text-5xl mb-4 inline-block">
              inventory_2
            </span>
            <p className="text-base text-on-surface-muted mb-6">
              You haven&apos;t submitted any applications yet.
            </p>
            <Link
              href="/apply"
              className="inline-flex items-center gap-2 px-5 py-3 text-base font-semibold bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors cursor-pointer focus:outline-2 focus:outline-offset-2 focus:outline-primary">
              <span className="material-symbols-outlined text-xl">add</span>
              Submit your first application
            </Link>
          </div>
        : <div className="flex-1 overflow-x-auto">
            <table className="w-full text-base min-w-max">
            <thead>
              <tr className="border-b border-outline bg-surface-dim">
                {["App ID", "Brand Name", "Submitted", "Status"].map((h) => (
                  <th
                    key={h}
                    className="px-6 py-4 text-left text-sm font-semibold text-on-surface-muted uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-surface-dim/60 transition-colors">
                  <td className="px-6 py-5 font-mono text-sm text-on-surface-dim">
                    {item.id}
                  </td>
                  <td className="px-6 py-5 text-base font-semibold text-on-surface">
                    {item.brandName}
                  </td>
                  <td className="px-6 py-5 text-base text-on-surface-muted">
                    {new Date(item.submittedAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-5">{statusBadge(item)}</td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        }
      </div>
    </div>
  );
}
