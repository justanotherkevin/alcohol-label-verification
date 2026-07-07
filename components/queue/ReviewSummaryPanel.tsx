"use client";

import { FieldResult } from "@/lib/verify";
import { MarkedAction } from "@/components/queue/FieldReviewCard";

interface ReviewSummaryPanelProps {
  stillFlagged: FieldResult[];
  totalFlagged: number;
  getMarkedAction: (fieldKey: string) => MarkedAction;
  onReviewField: (fieldKey: string) => void;
  onBackToFields: () => void;
}

export function ReviewSummaryPanel({
  stillFlagged,
  totalFlagged,
  getMarkedAction,
  onReviewField,
  onBackToFields,
}: ReviewSummaryPanelProps) {
  return (
    <div className="h-full flex flex-col gap-4">
      <h2 className="text-xl font-bold text-on-surface">Summary</h2>
      {stillFlagged.length === 0 ?
        <p className="text-base text-bp-success">
          All flagged fields have been accepted — ready to approve.
        </p>
      : <div>
          <p className="text-base text-on-surface-dim mb-2">
            {stillFlagged.length} field(s) still blocking approval:
          </p>
          <ul className="space-y-1">
            {stillFlagged.map((f) => {
              const action = getMarkedAction(f.field);
              return (
                <li
                  key={f.field}
                  className="text-base text-on-surface-dim flex items-center justify-between gap-2">
                  <span>{f.label}</span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-sm font-medium ${
                        action === "reject" ? "text-bp-error"
                        : action === "skip" ? "text-on-surface-muted"
                        : "text-bp-warning"
                      }`}>
                      {action === "reject" ? "Rejected"
                      : action === "skip" ? "Skipped"
                      : "Needs review"}
                    </span>
                    <button
                      onClick={() => onReviewField(f.field)}
                      className="cursor-pointer text-sm text-primary hover:text-primary-hover underline">
                      Review
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      }
      {totalFlagged > 0 && (
        <button
          onClick={onBackToFields}
          className="cursor-pointer mt-auto text-base text-primary hover:text-primary-hover underline self-start">
          ← back to fields
        </button>
      )}
    </div>
  );
}
