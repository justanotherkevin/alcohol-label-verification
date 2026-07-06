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
      <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold bg-surface-dim text-on-surface-dim border border-outline">
        Waiting for reviewer
      </span>
    );
  }
  if (item.status === "resolved") {
    return (
      <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold bg-bp-success-surface text-bp-success border border-bp-success-border">
        Resolved
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold bg-bp-warning-surface text-bp-warning border border-bp-warning-border">
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
    <div className="min-h-screen max-w-4xl p-8 mx-auto">
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
          className="px-5 py-3 text-base font-semibold bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors cursor-pointer focus:outline-2 focus:outline-offset-2 focus:outline-primary whitespace-nowrap">
          Submit a new application
        </Link>
      </div>

      <div className="bg-surface-card border border-outline rounded-2xl overflow-hidden flex flex-col">
        {loading ?
          <p className="px-6 py-8 text-base text-on-surface-muted">Loading…</p>
        : items.length === 0 ?
          <div className="px-6 py-12 text-center">
            <p className="text-base text-on-surface-muted mb-6">
              You haven&apos;t submitted any applications yet.
            </p>
            <Link
              href="/apply"
              className="inline-block px-5 py-3 text-base font-semibold bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors cursor-pointer focus:outline-2 focus:outline-offset-2 focus:outline-primary">
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
                <tr key={item.id} className="hover:bg-surface-dim transition-colors">
                  <td className="px-6 py-5 font-mono text-sm text-on-surface-dim">
                    {item.id}
                  </td>
                  <td className="px-6 py-5 text-base font-medium text-on-surface">
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
