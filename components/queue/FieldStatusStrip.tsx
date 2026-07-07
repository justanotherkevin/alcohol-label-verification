"use client";

import { FieldResult } from "@/lib/verify";
import { effectiveSeverity, FieldSeverity } from "@/lib/queue/field-status";

type OverrideDecision = "approve" | "flag";
interface OverrideEntry {
  reason: string;
  decision: OverrideDecision;
}

const SEVERITY_BG: Record<FieldSeverity, string> = {
  pass: "bg-bp-success",
  warn: "bg-bp-warning",
  fail: "bg-bp-error",
};

interface FieldStatusStripProps {
  appId: string;
  orderedFields: FieldResult[];
  overrides: Record<string, OverrideEntry>;
  currentFlaggedIndex: number;
  totalFlagged: number;
  atSummary: boolean;
  selectedFieldKey: string | null;
  onSelectField: (fieldKey: string) => void;
  onSkipToSummary: () => void;
  onNextField: () => void;
}

export function FieldStatusStrip({
  appId,
  orderedFields,
  overrides,
  currentFlaggedIndex,
  totalFlagged,
  atSummary,
  selectedFieldKey,
  onSelectField,
  onSkipToSummary,
  onNextField,
}: FieldStatusStripProps) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-outline bg-surface-dim px-6 py-5">
      <div className="flex items-center gap-5 min-w-0">
        <span className="font-mono text-base font-semibold text-on-surface shrink-0">{appId}</span>
        <div className="flex items-center gap-2 shrink-0">
          {orderedFields.map((f) => {
            const severity = effectiveSeverity(f, overrides[f.field]);
            return (
              <button
                key={f.field}
                title={f.label}
                aria-label={`${f.label} — ${severity}`}
                onClick={() => onSelectField(f.field)}
                className={`cursor-pointer h-4 w-10 rounded-full transition-opacity hover:opacity-70 ${SEVERITY_BG[severity]} ${
                  selectedFieldKey === f.field ? "ring-2 ring-offset-2 ring-on-surface" : ""
                }`}
              />
            );
          })}
        </div>
        <span className="text-base text-on-surface-muted truncate">
          {atSummary || totalFlagged === 0 ?
            "Summary"
          : `${currentFlaggedIndex + 1} / ${totalFlagged} — showing flagged first`}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {totalFlagged > 0 && (
          <button
            onClick={onNextField}
            className="cursor-pointer px-4 py-2.5 bg-primary text-white rounded-lg text-base font-medium hover:bg-primary-hover">
            Next field →
          </button>
        )}
        {!atSummary && totalFlagged > 0 && (
          <button
            onClick={onSkipToSummary}
            className="cursor-pointer px-4 py-2.5 border border-outline rounded-lg text-base font-medium text-on-surface-dim hover:text-on-surface">
            Skip to summary
          </button>
        )}
      </div>
    </div>
  );
}
