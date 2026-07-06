"use client";

import { FieldResult } from "@/lib/verify";
import { BoundingBox } from "@/lib/ocr/types";
import { FieldSeverity } from "@/lib/queue/field-status";
import { FieldValueRows, SEVERITY_LABEL, SEVERITY_PILL } from "@/components/queue/FieldReviewCard";

interface PassedFieldPanelProps {
  field: FieldResult;
  boxes?: BoundingBox[];
  severity: FieldSeverity;
  isManuallyFlagged: boolean;
  onFlag: () => void;
  onClearFlag: () => void;
  onBack: () => void;
}

export function PassedFieldPanel({
  field,
  boxes = [],
  severity,
  isManuallyFlagged,
  onFlag,
  onClearFlag,
  onBack,
}: PassedFieldPanelProps) {
  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex items-center gap-3">
        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${SEVERITY_PILL[severity]}`}>
          {SEVERITY_LABEL[severity]}
        </span>
        <h2 className="text-xl font-bold text-on-surface">{field.label}</h2>
      </div>

      <FieldValueRows field={field} boxes={boxes} />

      <div>
        <p className="text-sm font-medium text-on-surface mb-2">
          This field already passed. Disagree with it?
        </p>
        {isManuallyFlagged ?
          <button
            onClick={onClearFlag}
            className="cursor-pointer px-4 py-2 rounded-lg text-sm font-semibold border border-outline text-on-surface-dim">
            Clear flag
          </button>
        : <button
            onClick={onFlag}
            className="cursor-pointer px-4 py-2 rounded-lg text-sm font-semibold border border-bp-error-border text-bp-error">
            ⚠ Flag as issue
          </button>
        }
      </div>

      <button
        onClick={onBack}
        className="cursor-pointer mt-auto text-sm text-primary hover:text-primary-hover underline self-start">
        ← back to review
      </button>
    </div>
  );
}
