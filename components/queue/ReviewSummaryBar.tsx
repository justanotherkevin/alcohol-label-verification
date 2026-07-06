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
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${colorClass}`}>
      {count} {label}
    </span>
  );
}

interface ReviewSummaryBarProps {
  passCount: number;
  warnCount: number;
  failCount: number;
  canApprove: boolean;
  canDeny: boolean;
  submitting: boolean;
  errorMessage: string | null;
  onApprove: () => void;
  onDenyClick: () => void;
}

export function ReviewSummaryBar({
  passCount,
  warnCount,
  failCount,
  canApprove,
  canDeny,
  submitting,
  errorMessage,
  onApprove,
  onDenyClick,
}: ReviewSummaryBarProps) {
  return (
    <div className="bg-[#1c1c1c] px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-2">
        <span className="text-sm text-white/50">All fields reviewed:</span>
        <CountPill
          count={passCount}
          label="pass"
          colorClass="bg-bp-success-surface text-bp-success border-bp-success-border"
        />
        <CountPill
          count={warnCount}
          label="warn"
          colorClass="bg-bp-warning-surface text-bp-warning border-bp-warning-border"
        />
        <CountPill
          count={failCount}
          label="fail"
          colorClass="bg-bp-error-surface text-bp-error border-bp-error-border"
        />
        {errorMessage && <span className="text-sm text-bp-error">{errorMessage}</span>}
      </div>
      <div className="flex gap-3">
        <button
          onClick={onApprove}
          disabled={!canApprove || submitting}
          className="cursor-pointer px-5 py-2.5 bg-bp-success text-white text-sm font-semibold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed">
          ✓ Approve Application
        </button>
        <button
          onClick={onDenyClick}
          disabled={!canDeny || submitting}
          className="cursor-pointer px-5 py-2.5 border border-bp-error text-bp-error text-sm font-semibold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed">
          ✗ Deny
        </button>
      </div>
    </div>
  );
}
