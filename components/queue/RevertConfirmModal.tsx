"use client";

interface RevertConfirmModalProps {
  open: boolean;
  submitting: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function RevertConfirmModal({ open, submitting, onConfirm, onClose }: RevertConfirmModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={onClose}>
      <div
        className="bg-surface-card border border-outline rounded-2xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-on-surface mb-2">Revert to queue?</h3>
        <p className="text-sm text-on-surface-muted mb-4">
          This will remove the resolution and return the application to the queue for re-review.
          This cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="cursor-pointer text-xs px-3 py-2 border border-outline rounded-lg text-on-surface-dim">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={submitting}
            className="cursor-pointer text-xs px-3 py-2 bg-primary text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">
            {submitting ? "Reverting…" : "Revert"}
          </button>
        </div>
      </div>
    </div>
  );
}
