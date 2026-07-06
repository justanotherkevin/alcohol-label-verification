"use client";

import { useEffect, useRef, useState } from "react";
import {
  DEMO_SPECIALISTS,
  DemoSpecialist,
  setCurrentSpecialist,
} from "@/lib/queue/specialist";
import {
  DEMO_APPLICANTS,
  DemoApplicant,
  setCurrentApplicant,
} from "@/lib/queue/applicant";

interface LoginModalProps {
  dismissible?: boolean;
  onClose?: (role: "specialist" | "applicant") => void;
}

export default function LoginModal({
  dismissible = false,
  onClose,
}: LoginModalProps) {
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
          onClose?.("specialist");
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

  function handleSelectSpecialist(specialist: DemoSpecialist) {
    setSelected(specialist);
    setDropdownOpen(false);
  }

  function handleSpecialistSignIn() {
    if (!selected) return;
    setCurrentSpecialist({
      id: selected.id,
      name: selected.name,
      role: selected.role,
    });
    onClose?.("specialist");
  }

  function handleApplicantSignIn(applicant: DemoApplicant) {
    setCurrentApplicant({ id: applicant.id, name: applicant.name });
    onClose?.("applicant");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="relative bg-surface-card border border-outline rounded-2xl shadow-2xl w-full max-w-2xl">
        {dismissible && (
          <button
            onClick={() => onClose?.("specialist")}
            className="absolute top-4 right-4 text-on-surface-muted hover:text-on-surface transition-colors z-10"
            aria-label="Close">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        )}

        <div className="px-8 pt-8 pb-2 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-2xl">
            verified
          </span>
          <p className="text-sm font-bold text-primary tracking-widest uppercase">
            TTB
          </p>
        </div>
        <h2
          className="px-8 text-2xl font-bold text-on-surface mb-2"
          style={{ fontFamily: "var(--font-inter)" }}>
          Sign in
        </h2>
        <p className="px-8 text-base text-on-surface-muted mb-6">
          Choose a demo account to continue
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-outline border-t border-outline">
          {/* Specialist column */}
          <div className="p-8">
            <label className="block text-sm font-semibold text-on-surface-muted uppercase tracking-wide mb-3">
              Specialist
            </label>
            <p className="text-base text-on-surface-muted mb-4">
              Review and resolve submitted applications.
            </p>

            <div ref={containerRef} className="relative mb-5">
              <button
                type="button"
                onClick={() => setDropdownOpen((o) => !o)}
                className="w-full flex items-center gap-3 px-4 py-3 border-2 border-outline rounded-lg bg-surface text-base text-left transition-colors hover:border-primary cursor-pointer focus:outline-2 focus:outline-offset-2 focus:outline-primary">
                {selected ?
                  <>
                    <span
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                      style={{ backgroundColor: selected.color }}>
                      {selected.initials}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-semibold text-on-surface">
                        {selected.name}
                      </span>
                      <span className="block text-sm text-on-surface-muted">
                        {selected.role}
                      </span>
                    </span>
                  </>
                : <span className="text-on-surface-muted flex-1 font-medium">
                    Choose a specialist…
                  </span>
                }
              </button>

              {dropdownOpen && (
                <div className="absolute top-full mt-2 left-0 right-0 bg-surface-card border border-outline rounded-xl shadow-lg z-10 overflow-hidden">
                  {DEMO_SPECIALISTS.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleSelectSpecialist(s)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-base text-left transition-colors hover:bg-surface-dim cursor-pointer ${
                        selected?.id === s.id ? "bg-surface-dim" : ""
                      }`}>
                      <span
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                        style={{ backgroundColor: s.color }}>
                        {s.initials}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block font-semibold text-on-surface">
                          {s.name}
                        </span>
                        <span className="block text-sm text-on-surface-muted">
                          {s.role}
                        </span>
                      </span>
                      {selected?.id === s.id && (
                        <span className="material-symbols-outlined text-[20px] text-primary">
                          check
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={handleSpecialistSignIn}
              disabled={!selected}
              className="w-full py-3 bg-primary text-white text-base font-semibold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-opacity focus:outline-2 focus:outline-offset-2 focus:outline-primary hover:bg-primary-hover">
              {selected ? `Sign in as ${selected.name}` : "Sign in"}
            </button>
          </div>

          {/* Applicant column */}
          <div className="p-8">
            <label className="block text-sm font-semibold text-on-surface-muted uppercase tracking-wide mb-3">
              Applicant
            </label>
            <p className="text-base text-on-surface-muted mb-4">
              Submit a new COLA application for review.
            </p>

            <div className="space-y-3">
              {DEMO_APPLICANTS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => handleApplicantSignIn(a)}
                  className="w-full flex items-center gap-3 px-4 py-3 border-2 border-outline rounded-lg bg-surface text-base text-left transition-colors hover:border-primary cursor-pointer focus:outline-2 focus:outline-offset-2 focus:outline-primary">
                  <span
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                    style={{ backgroundColor: a.color }}>
                    {a.initials}
                  </span>
                  <span className="flex-1 min-w-0 font-semibold text-on-surface truncate">
                    {a.name}
                  </span>
                  <span className="material-symbols-outlined text-[20px] text-on-surface-muted">
                    swap_horiz
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
