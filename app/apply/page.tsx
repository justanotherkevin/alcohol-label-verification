"use client";

import { useState } from "react";
import Link from "next/link";
import { useIdentity } from "@/components/AppShell";
import { LABEL_CATALOG, LabelCatalogEntry } from "@/lib/queue/label-catalog";
import { ApplicationData } from "@/lib/verify";

type Step = "pick" | "review" | "submitted";

const FIELD_LABELS: { key: keyof ApplicationData; label: string }[] = [
  { key: "brandName", label: "Brand Name" },
  { key: "classType", label: "Class / Type" },
  { key: "abv", label: "Alcohol Content (ABV)" },
  { key: "netContents", label: "Net Contents" },
  { key: "bottler", label: "Bottler / Producer" },
  { key: "countryOfOrigin", label: "Country of Origin" },
  { key: "governmentWarning", label: "Government Warning" },
];

export default function ApplyPage() {
  const { applicant, requestLogin } = useIdentity();
  const [step, setStep] = useState<Step>("pick");
  const [selected, setSelected] = useState<LabelCatalogEntry | null>(null);
  const [formData, setFormData] = useState<ApplicationData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  function handlePick(entry: LabelCatalogEntry) {
    setSelected(entry);
    setFormData(entry.applicationData);
    setStep("review");
  }

  function handleFieldChange(key: keyof ApplicationData, value: string) {
    setFormData((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function handleSubmit() {
    if (!selected || !applicant || !formData) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicant: applicant.name,
          catalogKey: selected.key,
          applicationData: formData,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Submission failed");
      }
      const data = (await res.json()) as { id: string };
      setSubmittedId(data.id);
      setStep("submitted");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmitAnother() {
    setSelected(null);
    setFormData(null);
    setSubmittedId(null);
    setError(null);
    setStep("pick");
  }

  if (!applicant) {
    return (
      <div className="min-h-screen flex items-center justify-center px-8">
        <div className="bg-surface-card border border-outline rounded-2xl p-8 text-center max-w-sm">
          <p className="text-base text-on-surface-muted mb-6">
            You&apos;re not signed in as an applicant.
          </p>
          <button
            onClick={requestLogin}
            className="px-5 py-3 text-base font-semibold bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors cursor-pointer focus:outline-2 focus:outline-offset-2 focus:outline-primary">
            Sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-8 py-8 max-w-4xl mx-auto">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1
            className="text-3xl font-bold text-on-surface"
            style={{ fontFamily: "var(--font-inter)" }}>
            Submit a COLA Application
          </h1>
          <p className="text-base text-on-surface-muted mt-2">
            Signed in as {applicant.name}
          </p>
        </div>
      </div>

      {step === "pick" && (
        <div>
          <h2
            className="text-lg font-semibold text-on-surface mb-3"
            style={{ fontFamily: "var(--font-inter)" }}>
            Select a label image
          </h2>
          <p className="text-base text-on-surface-muted mb-6">
            This is a demo environment. Each label below comes with its application data
            pre-filled so you can focus on trying out the submission flow — choose one to continue.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            {LABEL_CATALOG.map((entry) => (
              <button
                key={entry.key}
                onClick={() => handlePick(entry)}
                className="bg-surface-card border-2 border-outline rounded-2xl overflow-hidden text-left hover:border-primary cursor-pointer focus:outline-2 focus:outline-offset-2 focus:outline-primary transition-colors">
                <div
                  className={`flex ${entry.imageKeys.length > 1 ? "divide-x divide-outline" : ""}`}>
                  {entry.imageKeys.map((imgKey) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={imgKey}
                      src={`/demo-labels/${imgKey.split("/").pop()}`}
                      alt={entry.displayName}
                      className="h-40 flex-1 object-cover bg-surface-dim"
                    />
                  ))}
                </div>
                <div className="p-4">
                  <p className="text-base font-semibold text-on-surface truncate">
                    {entry.displayName}
                  </p>
                  {entry.imageKeys.length > 1 && (
                    <span className="inline-block mt-2 text-xs font-bold uppercase tracking-wide text-on-surface-muted bg-surface-dim px-3 py-1 rounded-full">
                      Front + Back
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === "review" && selected && formData && (
        <div>
          <button
            onClick={() => setStep("pick")}
            className="px-4 py-2 text-base font-semibold text-on-surface-dim bg-surface-dim hover:bg-outline rounded-lg mb-6 transition-colors cursor-pointer focus:outline-2 focus:outline-offset-2 focus:outline-primary">
            ← Choose a different label
          </button>

          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <p className="text-sm font-semibold text-on-surface-muted uppercase tracking-wide mb-4">
                {selected.displayName}
              </p>
              <div className="space-y-4">
                {selected.imageKeys.map((imgKey) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={imgKey}
                    src={`/demo-labels/${imgKey.split("/").pop()}`}
                    alt={selected.displayName}
                    className="w-full rounded-2xl border-2 border-outline bg-surface-dim"
                  />
                ))}
              </div>
            </div>

            <div className="bg-surface-card border border-outline rounded-2xl p-6">
              <p className="text-sm font-semibold text-on-surface-muted uppercase tracking-wide mb-2">
                Application data
              </p>
              <p className="text-base text-on-surface-muted mb-6">
                Auto-filled from the selected label — edit if you need to demo a
                mismatch.
              </p>
              <div className="space-y-5">
                {FIELD_LABELS.map(({ key, label }) =>
                  key === "governmentWarning" ?
                    <div key={key}>
                      <label className="block text-base font-semibold text-on-surface-muted mb-2">
                        {label}
                      </label>
                      <textarea
                        value={formData[key]}
                        onChange={(e) => handleFieldChange(key, e.target.value)}
                        rows={4}
                        className="w-full text-base text-on-surface font-medium bg-surface border-2 border-outline rounded-lg px-4 py-3 focus:outline-none focus:border-primary"
                      />
                    </div>
                  : <div key={key}>
                      <label className="block text-base font-semibold text-on-surface-muted mb-2">
                        {label}
                      </label>
                      <input
                        type="text"
                        value={formData[key]}
                        onChange={(e) => handleFieldChange(key, e.target.value)}
                        className="w-full h-12 text-base text-on-surface font-medium bg-surface border-2 border-outline rounded-lg px-4 py-3 focus:outline-none focus:border-primary"
                      />
                    </div>,
                )}
              </div>

              {error && <p className="text-base text-bp-error mt-6 font-semibold">{error}</p>}

              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full mt-8 py-3 bg-primary text-white text-base font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-opacity focus:outline-2 focus:outline-offset-2 focus:outline-primary hover:bg-primary-hover">
                {submitting ? "Submitting…" : "Submit Application"}
              </button>
            </div>
          </div>
        </div>
      )}

      {step === "submitted" && (
        <div className="bg-surface-card border border-outline rounded-2xl p-10 text-center">
          <span className="material-symbols-outlined text-bp-success text-5xl mb-4">
            assignment_turned_in
          </span>
          <h2
            className="text-2xl font-bold text-on-surface mb-3"
            style={{ fontFamily: "var(--font-inter)" }}>
            Application submitted
          </h2>
          <p className="text-base text-on-surface-muted mb-2">
            Waiting for a reviewer to review this application.
          </p>
          <p className="text-sm font-mono text-on-surface-dim mb-8 bg-surface-dim px-4 py-2 rounded-lg inline-block">
            {submittedId}
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <button
              onClick={handleSubmitAnother}
              className="px-5 py-3 text-base font-semibold border-2 border-outline rounded-lg text-on-surface-dim hover:bg-surface-dim transition-colors cursor-pointer focus:outline-2 focus:outline-offset-2 focus:outline-primary">
              Submit another
            </button>
            <Link
              href="/"
              className="px-5 py-3 text-base font-semibold bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors cursor-pointer focus:outline-2 focus:outline-offset-2 focus:outline-primary inline-block">
              View my applications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
