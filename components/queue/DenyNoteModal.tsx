"use client";

import { useState } from "react";

interface DenyNoteModalProps {
  open: boolean;
  submitting: boolean;
  onConfirm: (note: string) => void;
  onClose: () => void;
}

export function DenyNoteModal({ open, submitting, onConfirm, onClose }: DenyNoteModalProps) {
  const [note, setNote] = useState("");

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={onClose}>
      <div
        className="bg-surface-card rounded-2xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-on-surface mb-3">Deny application</h3>
        <textarea
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Rejection note (required)…"
          className="w-full border border-outline rounded-lg px-3 py-2 text-sm bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="cursor-pointer text-xs px-3 py-2 border border-outline rounded-lg text-on-surface-dim">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(note)}
            disabled={!note.trim() || submitting}
            className="cursor-pointer text-xs px-3 py-2 bg-bp-error text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">
            Confirm Deny
          </button>
        </div>
      </div>
    </div>
  );
}
