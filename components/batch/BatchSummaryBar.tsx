"use client";

function CountPill({
  count,
  label,
  colorClass,
}: {
  count: number;
  label: string;
  colorClass: string;
}) {
  return (
    <span className={`px-2.5 py-1 rounded-full text-sm font-semibold border ${colorClass}`}>
      {count} {label}
    </span>
  );
}

interface BatchSummaryBarProps {
  total: number;
  passed: number;
  rejected: number;
  pendingReview: number;
  errors: number;
}

export function BatchSummaryBar({
  total,
  passed,
  rejected,
  pendingReview,
  errors,
}: BatchSummaryBarProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <CountPill
        count={passed}
        label="passed"
        colorClass="bg-bp-success-surface text-bp-success border-bp-success-border"
      />
      <CountPill
        count={rejected}
        label="rejected"
        colorClass="bg-bp-error-surface text-bp-error border-bp-error-border"
      />
      <CountPill
        count={pendingReview}
        label="pending review"
        colorClass="bg-bp-warning-surface text-bp-warning border-bp-warning-border"
      />
      {errors > 0 && (
        <CountPill
          count={errors}
          label="errors"
          colorClass="bg-bp-error-surface text-bp-error border-bp-error-border"
        />
      )}
      <span className="text-base text-on-surface-muted">out of {total}</span>
    </div>
  );
}
