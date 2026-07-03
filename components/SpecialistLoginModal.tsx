"use client";

import { useEffect, useRef, useState } from "react";
import {
  DEMO_SPECIALISTS,
  DemoSpecialist,
  setCurrentSpecialist,
} from "@/lib/queue/specialist";

interface SpecialistLoginModalProps {
  dismissible?: boolean;
  onClose?: () => void;
}

export default function SpecialistLoginModal({
  dismissible = false,
  onClose,
}: SpecialistLoginModalProps) {
  const [selected, setSelected] = useState<DemoSpecialist | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (dropdownOpen) {
          setDropdownOpen(false);
        } else if (dismissible) {
          onClose?.();
        }
      }
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [dismissible, dropdownOpen, onClose]);

  function handleSelect(specialist: DemoSpecialist) {
    setSelected(specialist);
    setDropdownOpen(false);
  }

  function handleSignIn() {
    if (!selected) return;
    setCurrentSpecialist({
      id: selected.id,
      name: selected.name,
      role: selected.role,
    });
    onClose?.();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="relative bg-surface-card border border-outline rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-8">
        {dismissible && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-on-surface-muted hover:text-on-surface transition-colors"
            aria-label="Close">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        )}

        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <span className="material-symbols-outlined text-primary text-xl">
            verified
          </span>
          <p className="text-xs font-semibold text-primary tracking-widest uppercase">
            TTB
          </p>
        </div>
        <h2
          className="text-xl font-bold text-on-surface mb-1"
          style={{ fontFamily: "var(--font-inter)" }}>
          Sign in
        </h2>
        <p className="text-sm text-on-surface-muted mb-6">
          Select a demo account to continue
        </p>

        {/* Selector */}
        <div ref={containerRef} className="relative mb-6">
          <label className="block text-xs font-semibold text-on-surface-muted uppercase tracking-wide mb-1.5">
            Specialist
          </label>
          <button
            type="button"
            onClick={() => setDropdownOpen((o) => !o)}
            className="w-full flex items-center gap-3 px-3 py-2.5 border border-outline rounded-lg bg-surface text-sm text-left transition-colors hover:border-primary focus:outline-none focus:border-primary">
            {selected ?
              <>
                <span
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                  style={{ backgroundColor: selected.color }}>
                  {selected.initials}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-medium text-on-surface">
                    {selected.name}
                  </span>
                  <span className="block text-xs text-on-surface-muted">
                    {selected.role}
                  </span>
                </span>
              </>
            : <span className="text-on-surface-muted flex-1">
                Choose a specialist…
              </span>
            }
          </button>

          {dropdownOpen && (
            <div className="absolute top-full mt-1 left-0 right-0 bg-surface-card border border-outline rounded-xl shadow-lg z-10 overflow-hidden">
              {DEMO_SPECIALISTS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleSelect(s)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors hover:bg-surface-dim ${
                    selected?.id === s.id ? "bg-surface-dim" : ""
                  }`}>
                  <span
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ backgroundColor: s.color }}>
                    {s.initials}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-medium text-on-surface">
                      {s.name}
                    </span>
                    <span className="block text-xs text-on-surface-muted">
                      {s.role}
                    </span>
                  </span>
                  {selected?.id === s.id && (
                    <span className="material-symbols-outlined text-[16px] text-primary">
                      check
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={handleSignIn}
          disabled={!selected}
          className="w-full py-2.5 bg-primary text-white text-sm font-semibold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-opacity">
          {selected ? `Sign in as ${selected.name}` : "Sign in"}
        </button>
      </div>
    </div>
  );
}
