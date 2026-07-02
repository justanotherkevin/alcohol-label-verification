"use client";

import { useState, useEffect } from "react";

type OverrideDecision = "approve" | "flag";
interface OverrideEntry {
  reason: string;
  decision: OverrideDecision;
}

interface OverrideModalProps {
  fieldKey: string | null;
  existingOverride: OverrideEntry | undefined;
  onSave: (decision: OverrideDecision, reason: string) => void;
  onClose: () => void;
}

export function OverrideModal({ fieldKey, existingOverride, onSave, onClose }: OverrideModalProps) {
  const [reason, setReason] = useState(existingOverride?.reason ?? "");

  useEffect(() => {
    setReason(existingOverride?.reason ?? "");
  }, [fieldKey, existingOverride]);

  if (!fieldKey) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={onClose}>
      <div
        className="bg-surface-card rounded-2xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-on-surface mb-3">Override field</h3>
        <textarea
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for this override…"
          className="w-full border border-outline rounded-lg px-3 py-2 text-sm bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="text-xs px-3 py-2 border border-outline rounded-lg text-on-surface-dim">
            Cancel
          </button>
          <button
            onClick={() => onSave("flag", reason)}
            disabled={!reason.trim()}
            className="text-xs px-3 py-2 bg-bp-error text-white rounded-lg disabled:opacity-50">
            Flag
          </button>
          <button
            onClick={() => onSave("approve", reason)}
            disabled={!reason.trim()}
            className="text-xs px-3 py-2 bg-bp-success text-white rounded-lg disabled:opacity-50">
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}
