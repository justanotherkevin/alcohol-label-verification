"use client";

import { useEffect } from "react";

interface ToastProps {
  message: string;
  onDismiss: () => void;
}

export function Toast({ message, onDismiss }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 6000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      role="status"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-4 rounded-xl border border-outline bg-surface-card px-5 py-4 shadow-lg max-w-sm">
      <p className="text-base text-on-surface">{message}</p>
      <button
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="text-on-surface-muted hover:text-on-surface cursor-pointer text-lg leading-none font-semibold focus:outline-2 focus:outline-offset-2 focus:outline-primary">
        &times;
      </button>
    </div>
  );
}
