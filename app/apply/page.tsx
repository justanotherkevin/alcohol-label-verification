"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useIdentity } from "@/components/AppShell";
import { LABEL_CATALOG, LabelCatalogEntry } from "@/lib/queue/label-catalog";
import { ApplicationData } from "@/lib/verify";

type Step = "pick" | "review" | "submitted";

interface PhotoSlot {
  imageKey: string;
  displayUrl: string;
  overridePath: string | null;
  overrideMimeType: string | null;
  uploading: boolean;
  error: string | null;
}

function defaultDisplayUrl(imageKey: string): string {
  return `/demo-labels/${imageKey.split("/").pop()}`;
}

function makePhotoSlots(entry: LabelCatalogEntry): PhotoSlot[] {
  return entry.imageKeys.map((imageKey) => ({
    imageKey,
    displayUrl: defaultDisplayUrl(imageKey),
    overridePath: null,
    overrideMimeType: null,
    uploading: false,
    error: null,
  }));
}

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
  const [photoSlots, setPhotoSlots] = useState<PhotoSlot[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  function handlePick(entry: LabelCatalogEntry) {
    setSelected(entry);
    setFormData(entry.applicationData);
    setPhotoSlots(makePhotoSlots(entry));
    setStep("review");
  }

  function handleFieldChange(key: keyof ApplicationData, value: string) {
    setFormData((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function handlePhotoFile(index: number, file: File) {
    const objectUrl = URL.createObjectURL(file);
    setPhotoSlots((prev) =>
      prev.map((slot, i) =>
        i === index ?
          { ...slot, displayUrl: objectUrl, uploading: true, error: null }
        : slot,
      ),
    );

    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Upload failed");
      }
      const { url, mimeType } = (await res.json()) as {
        url: string;
        mimeType: string;
      };
      URL.revokeObjectURL(objectUrl);
      setPhotoSlots((prev) =>
        prev.map((slot, i) =>
          i === index ?
            {
              ...slot,
              displayUrl: url,
              overridePath: url,
              overrideMimeType: mimeType,
              uploading: false,
            }
          : slot,
        ),
      );
    } catch (e) {
      URL.revokeObjectURL(objectUrl);
      setPhotoSlots((prev) =>
        prev.map((slot, i) =>
          i === index ?
            {
              ...slot,
              displayUrl: defaultDisplayUrl(slot.imageKey),
              uploading: false,
              error: e instanceof Error ? e.message : "Upload failed",
            }
          : slot,
        ),
      );
    }
  }

  async function handleSubmit() {
    if (!selected || !applicant || !formData) return;
    setSubmitting(true);
    setError(null);
    try {
      const imageOverrides: Record<number, { path: string; mimeType: string }> =
        {};
      photoSlots.forEach((slot, i) => {
        if (slot.overridePath && slot.overrideMimeType) {
          imageOverrides[i] = {
            path: slot.overridePath,
            mimeType: slot.overrideMimeType,
          };
        }
      });

      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicant: applicant.name,
          catalogKey: selected.key,
          applicationData: formData,
          imageOverrides,
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
    setPhotoSlots([]);
    setSubmittedId(null);
    setError(null);
    setStep("pick");
  }

  if (!applicant) {
    return (
      <div className="max-h-screen flex items-center justify-center px-8">
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
    <div className="max-h-screen px-8 py-8 max-w-5xl mx-auto">
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
          <p className="text-base text-on-surface-muted mb-6 max-w-2xl">
            This is a demo environment. Each label below comes with its
            application data pre-filled so you can focus on trying out the
            submission flow — choose one to continue.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            {LABEL_CATALOG.map((entry) => (
              <button
                key={entry.key}
                onClick={() => handlePick(entry)}
                className="group bg-surface-card border border-outline rounded-2xl overflow-hidden text-left shadow-sm hover:shadow-md hover:border-primary hover:-translate-y-0.5 cursor-pointer focus:outline-2 focus:outline-offset-2 focus:outline-primary transition-all">
                <div
                  className={`flex ${entry.imageKeys.length > 1 ? "divide-x divide-outline" : ""}`}>
                  {entry.imageKeys.map((imgKey) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={imgKey}
                      src={`/demo-labels/${imgKey.split("/").pop()}`}
                      alt={entry.displayName}
                      className="h-40 flex-1 object-cover bg-surface-dim transition-transform group-hover:scale-[1.03]"
                    />
                  ))}
                </div>
                <div className="p-4 flex items-center justify-between gap-2 border-t border-outline">
                  <p className="text-base font-semibold text-on-surface truncate">
                    {entry.displayName}
                  </p>
                  {entry.imageKeys.length > 1 && (
                    <span className="shrink-0 text-xs font-bold uppercase tracking-wide text-on-surface-muted bg-surface-dim px-3 py-1 rounded-full">
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
            className="flex items-center gap-1.5 px-4 py-2 text-base font-semibold text-on-surface-dim bg-surface-dim hover:bg-outline rounded-lg mb-6 transition-colors cursor-pointer focus:outline-2 focus:outline-offset-2 focus:outline-primary">
            <span className="material-symbols-outlined text-lg">
              arrow_back
            </span>
            Choose a different label
          </button>

          <div className="grid md:grid-cols-2 gap-8 items-start">
            <div className="md:sticky md:top-24">
              <p className="text-sm font-semibold text-on-surface-muted uppercase tracking-wide mb-4">
                {selected.displayName}
              </p>
              <div className="space-y-4">
                {photoSlots.map((slot, i) => (
                  <PhotoDropSlot
                    key={slot.imageKey}
                    slot={slot}
                    alt={selected.displayName}
                    onFile={(file) => handlePhotoFile(i, file)}
                  />
                ))}
              </div>
            </div>

            <div className="bg-surface-card border border-outline rounded-2xl p-6 shadow-sm">
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
                        className="w-full text-base text-on-surface font-medium bg-surface border-2 border-outline rounded-lg px-4 py-3 transition-colors focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
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
                        className="w-full h-12 text-base text-on-surface font-medium bg-surface border-2 border-outline rounded-lg px-4 py-3 transition-colors focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                      />
                    </div>,
                )}
              </div>

              {error && (
                <p className="flex items-center gap-2 text-base text-bp-error mt-6 font-semibold bg-bp-error-surface border border-bp-error-border rounded-lg px-4 py-3">
                  <span className="material-symbols-outlined text-xl">
                    error
                  </span>
                  {error}
                </p>
              )}

              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full mt-8 py-3 bg-primary text-white text-base font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors focus:outline-2 focus:outline-offset-2 focus:outline-primary hover:bg-primary-hover shadow-sm">
                {submitting ? "Submitting…" : "Submit Application"}
              </button>
            </div>
          </div>
        </div>
      )}

      {step === "submitted" && (
        <div className="bg-surface-card border border-outline rounded-2xl p-10 text-center shadow-sm max-w-xl mx-auto">
          <span className="inline-flex items-center justify-center size-16 rounded-full bg-bp-success-surface border border-bp-success-border mb-4">
            <span className="material-symbols-outlined text-bp-success text-4xl">
              assignment_turned_in
            </span>
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

function PhotoDropSlot({
  slot,
  alt,
  onFile,
}: {
  slot: PhotoSlot;
  alt: string;
  onFile: (file: File) => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      className={`relative rounded-2xl border-2 shadow-sm overflow-hidden transition-colors ${
        isDragOver ? "border-primary bg-primary/5" : "border-outline"
      }`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={slot.displayUrl} alt={alt} className="w-full bg-surface-dim" />

      {slot.uploading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <span className="material-symbols-outlined text-white text-3xl animate-spin">
            progress_activity
          </span>
        </div>
      )}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-2 text-sm font-semibold bg-surface-card/95 text-on-surface rounded-lg shadow-sm border border-outline hover:bg-surface-dim transition-colors cursor-pointer focus:outline-2 focus:outline-offset-2 focus:outline-primary">
        <span className="material-symbols-outlined text-lg">upload</span>
        Replace photo
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />

      {slot.error && (
        <p className="absolute bottom-0 inset-x-0 px-3 py-2 text-sm font-semibold text-white bg-bp-error/90">
          {slot.error}
        </p>
      )}
    </div>
  );
}
