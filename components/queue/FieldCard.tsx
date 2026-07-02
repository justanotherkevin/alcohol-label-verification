"use client";

import { RefObject } from "react";
import { FieldResult } from "@/lib/verify";
import { BoundingBox, BoundingBoxMap } from "@/lib/ocr/types";
import { isFieldFlagged } from "@/lib/queue/field-status";

type OverrideDecision = "approve" | "flag";
interface OverrideEntry {
  reason: string;
  decision: OverrideDecision;
}

interface LabelImage {
  base64: string;
  mimeType: string;
  side?: string;
}

interface FieldCardProps {
  field: FieldResult;
  override: OverrideEntry | undefined;
  selectedField: string | null;
  activeImageIndex: number;
  onFieldClick: (fieldKey: string) => void;
  onOpenOverride: (fieldKey: string) => void;
  onClearOverride: (fieldKey: string) => void;
  fieldBbox: BoundingBox | null | undefined;
  allImages: LabelImage[];
}

function StatusBadge({ status }: { status: FieldResult["status"] }) {
  if (status === "pass")
    return <span className="text-bp-success font-bold text-lg">✓</span>;
  if (status === "fail")
    return <span className="text-bp-error font-bold text-lg">✗</span>;
  return <span className="text-bp-warning font-bold text-lg">—</span>;
}

function fieldBgColor(
  effectivelyFlagged: boolean,
  override: OverrideEntry | undefined,
  field: FieldResult,
): string {
  if (!effectivelyFlagged) return "bg-bp-success-surface border-bp-success-border";
  if (
    override?.decision === "flag" ||
    field.status === "fail" ||
    field.regulatory?.status === "fail"
  )
    return "bg-bp-error-surface border-bp-error-border";
  return "bg-bp-warning-surface border-bp-warning-border";
}

export function FieldCard({
  field: f,
  override,
  selectedField,
  activeImageIndex,
  onFieldClick,
  onOpenOverride,
  onClearOverride,
  fieldBbox,
  allImages,
}: FieldCardProps) {
  const isOverridden = Boolean(override);
  const flagged = isFieldFlagged(f);
  const effectivelyFlagged =
    (flagged && override?.decision !== "approve") ||
    (!flagged && override?.decision === "flag");

  const bgColor = fieldBgColor(effectivelyFlagged, override, f);

  const badgeStatus: FieldResult["status"] =
    override?.decision === "flag" ? "fail"
    : override?.decision === "approve" ? "pass"
    : flagged && f.status === "pass" ? "fail"
    : f.status;

  const bboxOnDifferentImage = fieldBbox && fieldBbox.imageIndex !== activeImageIndex;

  return (
    <div
      key={f.field}
      data-testid={`field-row-${f.field}`}
      className={`border rounded-lg p-4 ${bgColor} cursor-pointer ${selectedField === f.field ? "ring-2 ring-primary" : ""}`}
      onClick={() => onFieldClick(f.field)}>
      <div className="flex items-start gap-3">
        <StatusBadge status={badgeStatus} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-on-surface">
              {f.label}{" "}
              {isOverridden && (
                <span
                  className={`text-xs font-normal ${override!.decision === "flag" ? "text-bp-error" : "text-bp-success"}`}>
                  (
                  {override!.decision === "flag" ?
                    "Overridden → Flagged"
                  : "Overridden → Approved"}
                  )
                </span>
              )}
            </p>
            {bboxOnDifferentImage && (
              <span className="text-xs text-on-surface-muted">
                (
                {allImages[fieldBbox.imageIndex]?.side ??
                  `image ${fieldBbox.imageIndex + 1}`}
                )
              </span>
            )}
          </div>
          <div className="mt-1 text-sm space-y-1">
            <p className="text-on-surface-dim">
              <span className="font-medium">Application input:</span>{" "}
              <span className="font-mono">{f.expected ?? "—"}</span>
            </p>
            <p className={effectivelyFlagged ? "text-bp-error" : "text-on-surface-dim"}>
              <span className="font-medium">Found on label:</span>{" "}
              <span className="font-mono">{f.extracted ?? "not found"}</span>
            </p>
            {f.note && (
              <p className="text-on-surface-muted italic text-xs mt-1">{f.note}</p>
            )}
          </div>
          {f.regulatory && f.regulatory.status !== "skipped" && (
            <div className="mt-2 pt-2 border-t border-outline">
              <span className="text-xs font-medium text-on-surface-muted uppercase tracking-wide">
                Regulatory
              </span>
              <p
                className={`text-xs mt-0.5 ${
                  f.regulatory.status === "fail" ? "text-bp-error"
                  : f.regulatory.status === "warning" ? "text-bp-warning"
                  : "text-bp-success"
                }`}>
                {f.regulatory.status === "fail" ? "✗"
                : f.regulatory.status === "warning" ? "⚠"
                : "✓"}{" "}
                {f.regulatory.note}
              </p>
            </div>
          )}
          {isOverridden && (
            <p className="text-xs text-on-surface-muted mt-1 italic">
              Reason: {override!.reason}
            </p>
          )}
          <div className="mt-2 flex gap-2" onClick={(e) => e.stopPropagation()}>
            {isOverridden ?
              <button
                onClick={() => onClearOverride(f.field)}
                className="text-xs font-medium text-on-surface-dim hover:text-on-surface underline">
                Remove override
              </button>
            : <button
                onClick={() => onOpenOverride(f.field)}
                className="text-xs font-medium text-primary hover:text-primary-hover underline">
                Override
              </button>
            }
          </div>
        </div>
      </div>
    </div>
  );
}
