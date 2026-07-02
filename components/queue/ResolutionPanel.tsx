"use client";

import { useState } from "react";
import { FieldResult } from "@/lib/verify";

interface ResolutionPanelProps {
  canApprove: boolean;
  stillFlagged: FieldResult[];
  rejectedFields: string[];
  submitting: boolean;
  onApprove: () => Promise<void>;
  onToggleRejectedField: (fieldKey: string) => void;
  onConfirmReject: (rejectedFields: string[], note: string) => Promise<void>;
}

export function ResolutionPanel({
  canApprove,
  stillFlagged,
  rejectedFields,
  submitting,
  onApprove,
  onToggleRejectedField,
  onConfirmReject,
}: ResolutionPanelProps) {
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const validRejectedFieldCount = rejectedFields.filter((f) =>
    stillFlagged.some((sf) => sf.field === f),
  ).length;

  async function handleApprove() {
    setSubmitError(null);
    try {
      await onApprove();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Unknown error");
    }
  }

  async function handleConfirmReject() {
    setSubmitError(null);
    try {
      await onConfirmReject(rejectedFields, rejectNote);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Unknown error");
    }
  }

  return (
    <div className="mt-8 border-t border-outline pt-6">
      {submitError && (
        <div className="mb-4 bg-bp-error-surface border border-bp-error-border text-bp-error rounded-lg px-4 py-3 text-sm">
          {submitError}
        </div>
      )}

      {!rejectMode ?
        <div className="flex gap-3">
          <button
            onClick={handleApprove}
            disabled={!canApprove || submitting}
            className="px-5 py-2.5 bg-bp-success text-white text-sm font-semibold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed">
            Approve
          </button>
          <button
            onClick={() => setRejectMode(true)}
            disabled={stillFlagged.length === 0 || submitting}
            className="px-5 py-2.5 border border-bp-error text-bp-error text-sm font-semibold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed">
            Reject
          </button>
          {!canApprove && (
            <p className="text-xs text-on-surface-muted self-center">
              {stillFlagged.length} field(s) still flagged — override or reject
              them first.
            </p>
          )}
        </div>
      : <div className="space-y-3">
          <p className="text-sm font-medium text-on-surface">
            Select the field(s) that justify rejection:
          </p>
          <div className="space-y-1">
            {stillFlagged.map((f) => (
              <label key={f.field} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={rejectedFields.includes(f.field)}
                  onChange={() => onToggleRejectedField(f.field)}
                />
                {f.label}
              </label>
            ))}
          </div>
          <textarea
            rows={2}
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            placeholder="Rejection note (required)…"
            className="w-full border border-outline rounded-lg px-3 py-2 text-sm bg-surface-card text-on-surface"
          />
          <div className="flex gap-2">
            <button
              onClick={handleConfirmReject}
              disabled={
                validRejectedFieldCount === 0 ||
                !rejectNote.trim() ||
                submitting
              }
              className="px-5 py-2.5 bg-bp-error text-white text-sm font-semibold rounded-lg disabled:opacity-40">
              Confirm Reject
            </button>
            <button
              onClick={() => setRejectMode(false)}
              className="px-5 py-2.5 border border-outline text-on-surface-dim text-sm font-semibold rounded-lg">
              Cancel
            </button>
          </div>
        </div>
      }
    </div>
  );
}
