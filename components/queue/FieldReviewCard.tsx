"use client";

import type { ReactNode } from "react";
import { FieldResult } from "@/lib/verify";
import { FieldSeverity } from "@/lib/queue/field-status";

export const SEVERITY_PILL: Record<FieldSeverity, string> = {
  pass: "bg-bp-success-surface text-bp-success border-bp-success-border",
  warn: "bg-bp-warning-surface text-bp-warning border-bp-warning-border",
  fail: "bg-bp-error-surface text-bp-error border-bp-error-border",
};

export const SEVERITY_LABEL: Record<FieldSeverity, string> = {
  pass: "PASS",
  warn: "WARN",
  fail: "FAIL",
};

export type MarkedAction = "accept" | "reject" | "skip" | null;

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: ReactNode;
  tone?: "error" | "warning" | "success";
}) {
  const toneClass =
    tone === "error" ? "text-bp-error"
    : tone === "warning" ? "text-bp-warning"
    : tone === "success" ? "text-bp-success"
    : "text-on-surface";
  return (
    <div className="grid grid-cols-[110px_1fr] gap-4 px-4 py-3">
      <span className="text-xs uppercase tracking-wide text-on-surface-muted pt-0.5">{label}</span>
      <span className={`text-sm font-mono ${toneClass}`}>{value}</span>
    </div>
  );
}

export function FieldValueRows({ field }: { field: FieldResult }) {
  return (
    <div className="border border-outline rounded-lg divide-y divide-outline">
      <Row label="Application" value={field.expected ?? "—"} />
      <Row
        label="OCR Found"
        tone={field.status === "fail" ? "error" : field.status === "missing" ? "warning" : undefined}
        value={
          <>
            {field.extracted ?? "not found"}
            {typeof field.confidence === "number" && (
              <span className="text-on-surface-muted"> ({Math.round(field.confidence * 100)}%)</span>
            )}
          </>
        }
      />
      {field.regulatory && field.regulatory.status !== "skipped" && (
        <Row
          label="Regulation"
          tone={
            field.regulatory.status === "fail" ? "error"
            : field.regulatory.status === "warning" ? "warning"
            : "success"
          }
          value={
            <>
              {field.regulatory.status === "fail" ? "✗ "
              : field.regulatory.status === "warning" ? "⚠ "
              : "✓ "}
              {field.regulatory.note}
            </>
          }
        />
      )}
    </div>
  );
}

interface FieldReviewCardProps {
  field: FieldResult;
  severity: FieldSeverity;
  currentFlaggedIndex: number;
  totalFlagged: number;
  reviewedCount: number;
  leftCount: number;
  markedAction: MarkedAction;
  canPrev: boolean;
  canNext: boolean;
  onAccept: () => void;
  onReject: () => void;
  onSkip: () => void;
  onPrev: () => void;
  onNext: () => void;
}

export function FieldReviewCard({
  field,
  severity,
  currentFlaggedIndex,
  totalFlagged,
  reviewedCount,
  leftCount,
  markedAction,
  canPrev,
  canNext,
  onAccept,
  onReject,
  onSkip,
  onPrev,
  onNext,
}: FieldReviewCardProps) {
  return (
    <div className="bg-surface-card rounded-lg p-6 flex flex-col gap-6 h-full">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-bold border ${SEVERITY_PILL[severity]}`}>
            {SEVERITY_LABEL[severity]}
          </span>
          <h2 className="text-xl font-bold text-on-surface">{field.label}</h2>
        </div>
        <span className="text-sm text-on-surface-muted shrink-0">
          field {currentFlaggedIndex + 1} of {totalFlagged}
        </span>
      </div>

      <FieldValueRows field={field} />

      <div>
        <p className="text-sm font-medium text-on-surface mb-2">Override this field:</p>
        <div className="flex gap-2">
          <button
            onClick={onAccept}
            className={`cursor-pointer px-4 py-2 rounded-lg text-sm font-semibold border ${
              markedAction === "accept" ?
                "bg-bp-success text-white border-bp-success"
              : "border-bp-success-border text-bp-success"
            }`}>
            ✓ Accept
          </button>
          <button
            onClick={onReject}
            className={`cursor-pointer px-4 py-2 rounded-lg text-sm font-semibold border ${
              markedAction === "reject" ?
                "bg-bp-error text-white border-bp-error"
              : "border-bp-error-border text-bp-error"
            }`}>
            ✗ Reject
          </button>
          <button
            onClick={onSkip}
            className={`cursor-pointer px-4 py-2 rounded-lg text-sm font-semibold border ${
              markedAction === "skip" ?
                "bg-surface-dim text-on-surface border-outline"
              : "border-outline text-on-surface-dim"
            }`}>
            Skip
          </button>
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between pt-4 border-t border-outline">
        <button
          onClick={onPrev}
          disabled={!canPrev}
          className="cursor-pointer px-3 py-1.5 border border-outline rounded-lg text-sm text-on-surface-dim disabled:opacity-30 disabled:cursor-not-allowed">
          ← prev
        </button>
        <span className="text-sm text-on-surface-muted">
          {reviewedCount} reviewed · {leftCount} left
        </span>
        <button
          onClick={onNext}
          disabled={!canNext}
          className="cursor-pointer px-3 py-1.5 bg-on-surface text-surface-card rounded-lg text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed">
          next flag →
        </button>
      </div>
    </div>
  );
}
