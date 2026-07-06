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
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-surface-dim text-on-surface-dim border border-outline">
        Waiting for reviewer
      </span>
    );
  }
  if (item.status === "resolved") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-bp-success-surface text-bp-success border border-bp-success-border">
        Resolved
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-bp-warning-surface text-bp-warning border border-bp-warning-border">
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

  return (
    <div className="min-h-screen max-w-4xl  p-8 mx-auto">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1
            className="text-2xl font-bold text-on-surface"
            style={{ fontFamily: "var(--font-inter)" }}>
            My Applications
          </h1>
          <p className="text-sm text-on-surface-muted mt-1">
            COLA applications submitted by {applicantName}.
          </p>
        </div>
        <Link
          href="/apply"
          className="text-xs px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors">
          Submit a new application
        </Link>
      </div>

      <div className="bg-surface-card border border-outline rounded-2xl overflow-hidden">
        {loading ?
          <p className="px-6 py-8 text-sm text-on-surface-muted">Loading…</p>
        : items.length === 0 ?
          <div className="px-6 py-10 text-center">
            <p className="text-sm text-on-surface-muted mb-4">
              You haven&apos;t submitted any applications yet.
            </p>
            <Link
              href="/apply"
              className="text-xs px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors">
              Submit your first application
            </Link>
          </div>
        : <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline bg-surface-dim">
                {["App ID", "Brand Name", "Submitted", "Status"].map((h) => (
                  <th
                    key={h}
                    className="px-6 py-3 text-left text-xs font-semibold text-on-surface-muted uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-6 py-4 font-mono text-xs text-on-surface-dim">
                    {item.id}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-on-surface">
                    {item.brandName}
                  </td>
                  <td className="px-6 py-4 text-sm text-on-surface-muted">
                    {new Date(item.submittedAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">{statusBadge(item)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      </div>
    </div>
  );
}
