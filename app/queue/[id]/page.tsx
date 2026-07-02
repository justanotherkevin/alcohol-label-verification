"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { FieldResult } from "@/lib/verify";
import { BoundingBoxMap } from "@/lib/ocr/types";
import { isFieldFlagged } from "@/lib/queue/field-status";
import { LabelImage, OcrData, QueueStatus } from "@/lib/queue/types";
import { getCurrentSpecialist, specialistNameById } from "@/lib/queue/specialist";
import { ApplicationData } from "@/lib/verify";
import { ImageCarousel } from "@/components/queue/ImageCarousel";
import { FieldCard } from "@/components/queue/FieldCard";
import { OverrideModal } from "@/components/queue/OverrideModal";
import { ResolutionPanel } from "@/components/queue/ResolutionPanel";
import { RevertConfirmModal } from "@/components/queue/RevertConfirmModal";

interface QueueApplicationDetail {
  id: string;
  applicant: string;
  submittedAt: string;
  images: LabelImage[];
  applicationData: ApplicationData;
  status: QueueStatus;
  ocrData: OcrData | null;
  reviewData: {
    resolution: {
      decision: "approved" | "rejected";
      note: string;
      resolvedAt: string;
      specialistId?: string;
    } | null;
  };
}

type OverrideDecision = "approve" | "flag";
interface OverrideEntry {
  reason: string;
  decision: OverrideDecision;
}

export default function QueueDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [app, setApp] = useState<QueueApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, OverrideEntry>>({});
  const [overrideDraftField, setOverrideDraftField] = useState<string | null>(null);
  const [rejectedFields, setRejectedFields] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [revertConfirmOpen, setRevertConfirmOpen] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [revertError, setRevertError] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    fetch(`/api/queue/${params.id}`)
      .then((res) => res.json())
      .then((data: { application: QueueApplicationDetail }) => {
        setApp(data.application);
        setLoading(false);
      });
  }, [params.id]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const w = img.offsetWidth;
    const h = img.offsetHeight;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    if (!selectedField || !app?.ocrData?.boundingBoxes) return;
    const bbox = app.ocrData.boundingBoxes[selectedField as keyof BoundingBoxMap];
    if (!bbox || bbox.imageIndex !== activeImageIndex) return;
    ctx.strokeStyle = "#4c6080";
    ctx.lineWidth = 2;
    ctx.fillStyle = "rgba(76, 96, 128, 0.12)";
    ctx.beginPath();
    ctx.rect(bbox.x * w, bbox.y * h, bbox.width * w, bbox.height * h);
    ctx.fill();
    ctx.stroke();
  }, [selectedField, app, activeImageIndex]);

  function handleFieldClick(fieldKey: string) {
    const newSelected = selectedField === fieldKey ? null : fieldKey;
    setSelectedField(newSelected);
    if (newSelected && app?.ocrData?.boundingBoxes) {
      const bbox = app.ocrData.boundingBoxes[newSelected as keyof BoundingBoxMap];
      if (bbox && bbox.imageIndex !== activeImageIndex) {
        setActiveImageIndex(bbox.imageIndex);
      }
    }
  }

  function handleImageChange(index: number) {
    setActiveImageIndex(index);
    setSelectedField(null);
  }

  function handleSaveOverride(decision: OverrideDecision, reason: string) {
    if (!overrideDraftField || !reason.trim()) return;
    setOverrides((prev) => ({
      ...prev,
      [overrideDraftField]: { reason: reason.trim(), decision },
    }));
    if (decision === "approve") {
      setRejectedFields((prev) => prev.filter((f) => f !== overrideDraftField));
    }
    setOverrideDraftField(null);
  }

  function clearOverride(fieldKey: string) {
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[fieldKey];
      return next;
    });
    setRejectedFields((prev) => prev.filter((f) => f !== fieldKey));
  }

  function toggleRejectedField(fieldKey: string) {
    setRejectedFields((prev) =>
      prev.includes(fieldKey) ? prev.filter((f) => f !== fieldKey) : [...prev, fieldKey],
    );
  }

  async function submitResolution(
    decision: "approved" | "rejected",
    rejectedFieldsArg: string[],
    note: string,
  ) {
    if (!app) return;
    setSubmitting(true);
    const stillFlaggedKeys = new Set(stillFlagged.map((f) => f.field));
    const validRejectedFields = rejectedFieldsArg.filter((f) => stillFlaggedKeys.has(f));
    const specialist = getCurrentSpecialist();
    const body = {
      decision,
      overrides: Object.entries(overrides).map(([field, entry]) => ({
        field,
        reason: entry.reason,
        decision: entry.decision,
      })),
      rejectedFields: decision === "rejected" ? validRejectedFields : [],
      note: decision === "rejected" ? note : "",
      specialistId: specialist?.id,
    };
    const res = await fetch(`/api/queue/${app.id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = (await res.json()) as { error: string };
      throw new Error(data.error);
    }
    router.push("/");
  }

  async function handleRevert() {
    if (!app) return;
    setReverting(true);
    setRevertError(null);
    try {
      const res = await fetch(`/api/queue/${app.id}/revert`, { method: "POST" });
      if (!res.ok) {
        const data = (await res.json()) as { error: string };
        throw new Error(data.error);
      }
      router.push("/");
    } catch (e) {
      setRevertError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setReverting(false);
    }
  }

  const allFields = app?.ocrData?.result.fields ?? [];
  const naturallyStillFlagged = allFields.filter(
    (f) => isFieldFlagged(f) && overrides[f.field]?.decision !== "approve",
  );
  const manuallyFlagged = allFields.filter(
    (f) => !isFieldFlagged(f) && overrides[f.field]?.decision === "flag",
  );
  const stillFlagged = [...naturallyStillFlagged, ...manuallyFlagged];
  const canApprove = app?.ocrData !== null && stillFlagged.length === 0;

  if (loading)
    return <div className="px-8 py-8 text-sm text-on-surface-muted">Loading application…</div>;
  if (!app)
    return <div className="px-8 py-8 text-sm text-bp-error">Application not found.</div>;

  return (
    <div className="px-8 py-8 max-w-5xl">
      <div className="mb-8">
        <h1
          className="text-2xl font-bold text-on-surface"
          style={{ fontFamily: "var(--font-inter)" }}>
          {app.applicationData.brandName}
        </h1>
        <p className="text-sm text-on-surface-muted mt-1">
          {app.id} · {app.applicant} · submitted {new Date(app.submittedAt).toLocaleString()}
        </p>
      </div>

      {!app.ocrData ?
        <p className="text-sm text-on-surface-muted">
          This application has not been analyzed yet. Run pre-analysis from the queue screen first.
        </p>
      : <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <ImageCarousel
            images={app.images}
            activeImageIndex={activeImageIndex}
            selectedField={selectedField}
            hasBoundingBoxes={Boolean(app.ocrData.boundingBoxes)}
            onImageChange={handleImageChange}
            imgRef={imgRef}
            canvasRef={canvasRef}
          />

          <div className="space-y-3">
            {app.ocrData.result.fields.map((f) => (
              <FieldCard
                key={f.field}
                field={f}
                override={overrides[f.field]}
                selectedField={selectedField}
                activeImageIndex={activeImageIndex}
                onFieldClick={handleFieldClick}
                onOpenOverride={setOverrideDraftField}
                onClearOverride={clearOverride}
                fieldBbox={app.ocrData?.boundingBoxes?.[f.field as keyof BoundingBoxMap]}
                allImages={app.images}
              />
            ))}
          </div>
        </div>
      }

      <OverrideModal
        fieldKey={overrideDraftField}
        existingOverride={overrideDraftField ? overrides[overrideDraftField] : undefined}
        onSave={handleSaveOverride}
        onClose={() => setOverrideDraftField(null)}
      />

      {app.ocrData && app.status !== "resolved" && (
        <ResolutionPanel
          canApprove={canApprove ?? false}
          stillFlagged={stillFlagged}
          rejectedFields={rejectedFields}
          submitting={submitting}
          onApprove={() => submitResolution("approved", [], "")}
          onToggleRejectedField={toggleRejectedField}
          onConfirmReject={(fields, note) => submitResolution("rejected", fields, note)}
        />
      )}

      {app.status === "resolved" && app.reviewData.resolution && (
        <div className="mt-8 border-t border-outline pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-on-surface">
                {app.reviewData.resolution.decision === "approved" ? "Approved" : "Rejected"} by{" "}
                {app.reviewData.resolution.specialistId
                  ? specialistNameById(app.reviewData.resolution.specialistId)
                  : "Unknown"}
              </p>
              <p className="text-xs text-on-surface-muted mt-1">
                {new Date(app.reviewData.resolution.resolvedAt).toLocaleString()}
              </p>
              {app.reviewData.resolution.note && (
                <p className="text-sm text-on-surface-dim mt-2">{app.reviewData.resolution.note}</p>
              )}
            </div>
            <button
              onClick={() => setRevertConfirmOpen(true)}
              className="px-4 py-2 border border-outline text-on-surface-dim text-sm font-semibold rounded-lg">
              Revert to Queue
            </button>
          </div>
          {revertError && (
            <div className="mt-4 bg-bp-error-surface border border-bp-error-border text-bp-error rounded-lg px-4 py-3 text-sm">
              {revertError}
            </div>
          )}
        </div>
      )}

      <RevertConfirmModal
        open={revertConfirmOpen}
        submitting={reverting}
        onConfirm={handleRevert}
        onClose={() => setRevertConfirmOpen(false)}
      />
    </div>
  );
}
