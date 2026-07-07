"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { FieldResult } from "@/lib/verify";
import { BoundingBoxMap } from "@/lib/ocr/types";
import { isFieldFlagged, effectiveSeverity } from "@/lib/queue/field-status";
import { LabelImage, OcrData, QueueStatus } from "@/lib/queue/types";
import {
  getCurrentSpecialist,
  specialistNameById,
} from "@/lib/queue/specialist";
import { ApplicationData } from "@/lib/verify";
import { FieldStatusStrip } from "@/components/queue/FieldStatusStrip";
import { LabelRegionPanel } from "@/components/queue/LabelRegionPanel";
import { LabelOverviewPanel } from "@/components/queue/LabelOverviewPanel";
import {
  FieldReviewCard,
  MarkedAction,
} from "@/components/queue/FieldReviewCard";
import { PassedFieldPanel } from "@/components/queue/PassedFieldPanel";
import { ReviewSummaryPanel } from "@/components/queue/ReviewSummaryPanel";
import { ReviewSummaryBar } from "@/components/queue/ReviewSummaryBar";
import { DenyNoteModal } from "@/components/queue/DenyNoteModal";
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

const SETTINGS_KEY = "ttb-ocr-settings";

function flaggedFieldCount(application: QueueApplicationDetail): number {
  return (application.ocrData?.result.fields ?? []).filter(isFieldFlagged).length;
}

export default function QueueDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const batchIds = searchParams.get("batch")?.split(",").filter(Boolean) ?? [];
  const batchIndex = batchIds.indexOf(params.id);
  const [app, setApp] = useState<QueueApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [pinnedFieldKey, setPinnedFieldKey] = useState<string | null>(null);
  const [actionedFields, setActionedFields] = useState<Set<string>>(new Set());
  const [overrides, setOverrides] = useState<Record<string, OverrideEntry>>({});
  const [rejectedFields, setRejectedFields] = useState<string[]>([]);
  const [denyModalOpen, setDenyModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [revertConfirmOpen, setRevertConfirmOpen] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [revertError, setRevertError] = useState<string | null>(null);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [reanalyzeError, setReanalyzeError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setApp(null);
    setCurrentStepIndex(0);
    setPinnedFieldKey(null);
    setActionedFields(new Set());
    setOverrides({});
    setRejectedFields([]);
    setSubmitError(null);
    fetch(`/api/queue/${params.id}`)
      .then((res) => res.json())
      .then((data: { application: QueueApplicationDetail }) => {
        setApp(data.application);
        // Land on the Summary slide first — it's the most useful starting
        // point for a reviewer picking up an application.
        setCurrentStepIndex(flaggedFieldCount(data.application));
        setLoading(false);
      });
  }, [params.id]);

  async function handleReanalyze() {
    if (!app) return;
    setReanalyzing(true);
    setReanalyzeError(null);
    try {
      let settings: { provider?: string; apiKey?: string } = {};
      try {
        settings = JSON.parse(
          localStorage.getItem(SETTINGS_KEY) ?? "{}",
        ) as typeof settings;
      } catch {
        /* ignore malformed localStorage */
      }
      const res = await fetch("/api/queue/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Ocr-Provider": settings.provider ?? "tesseract",
          ...(settings.apiKey ? { "X-Api-Key": settings.apiKey } : {}),
        },
        body: JSON.stringify({ ids: [app.id], force: true }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error: string };
        throw new Error(data.error);
      }
      const refreshed = await fetch(`/api/queue/${app.id}`);
      const data = (await refreshed.json()) as {
        application: QueueApplicationDetail;
      };
      setApp(data.application);
      setCurrentStepIndex(flaggedFieldCount(data.application));
      setPinnedFieldKey(null);
      setActionedFields(new Set());
      setOverrides({});
      setRejectedFields([]);
    } catch (e) {
      setReanalyzeError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setReanalyzing(false);
    }
  }

  const allFields = app?.ocrData?.result.fields ?? [];

  // Captured once per application load so the stepper's denominator doesn't
  // shift as the reviewer accepts/rejects fields mid-review.
  const flaggedFieldKeys = useMemo(
    () => allFields.filter(isFieldFlagged).map((f) => f.field),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [app?.id],
  );

  const fieldByKey = new Map(allFields.map((f) => [f.field, f]));
  const orderedFields: FieldResult[] = [
    ...flaggedFieldKeys.map((k) => fieldByKey.get(k)!).filter(Boolean),
    ...allFields.filter((f) => !flaggedFieldKeys.includes(f.field)),
  ];

  const totalFlagged = flaggedFieldKeys.length;
  const atSummary = currentStepIndex >= totalFlagged;
  const currentFieldKey =
    !atSummary ? flaggedFieldKeys[currentStepIndex] : null;
  const currentField =
    currentFieldKey ? (fieldByKey.get(currentFieldKey) ?? null) : null;

  // What's actually on screen: a manually pinned field (clicked via a pill or
  // a Summary "Review" link) takes priority over the flagged stepper's
  // current position.
  const displayedFieldKey = pinnedFieldKey ?? currentFieldKey;
  const displayedField =
    displayedFieldKey ? (fieldByKey.get(displayedFieldKey) ?? null) : null;
  const displayedBoxes =
    displayedFieldKey ?
      (app?.ocrData?.boundingBoxes?.[displayedFieldKey as keyof BoundingBoxMap] ?? [])
    : [];
  const isDisplayedNaturallyFlagged =
    displayedFieldKey ? flaggedFieldKeys.includes(displayedFieldKey) : false;
  const displayedFieldNumber =
    displayedFieldKey ?
      orderedFields.findIndex((f) => f.field === displayedFieldKey) + 1
    : 0;

  const naturallyStillFlagged = allFields.filter(
    (f) => isFieldFlagged(f) && overrides[f.field]?.decision !== "approve",
  );
  const manuallyFlagged = allFields.filter(
    (f) => !isFieldFlagged(f) && overrides[f.field]?.decision === "flag",
  );
  const stillFlagged = [...naturallyStillFlagged, ...manuallyFlagged];
  const canApprove = app?.ocrData !== null && stillFlagged.length === 0;
  const canDeny = rejectedFields.length > 0;

  const reviewedCount = flaggedFieldKeys.filter((k) =>
    actionedFields.has(k),
  ).length;
  const leftCount = totalFlagged - reviewedCount;

  const severityCounts = allFields.reduce(
    (acc, f) => {
      const sev = effectiveSeverity(f, overrides[f.field]);
      acc[sev] += 1;
      return acc;
    },
    { pass: 0, warn: 0, fail: 0 },
  );

  function getMarkedAction(key: string): MarkedAction {
    if (overrides[key]?.decision === "approve") return "accept";
    if (rejectedFields.includes(key)) return "reject";
    if (actionedFields.has(key)) return "skip";
    return null;
  }

  const markedAction: MarkedAction =
    currentFieldKey ? getMarkedAction(currentFieldKey) : null;

  function markActioned(key: string) {
    setActionedFields((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }

  function handleAccept() {
    if (!currentFieldKey) return;
    setOverrides((prev) => ({
      ...prev,
      [currentFieldKey]: { reason: "", decision: "approve" },
    }));
    setRejectedFields((prev) => prev.filter((f) => f !== currentFieldKey));
    markActioned(currentFieldKey);
  }

  function handleReject() {
    if (!currentFieldKey) return;
    setOverrides((prev) => {
      if (prev[currentFieldKey]?.decision !== "approve") return prev;
      const next = { ...prev };
      delete next[currentFieldKey];
      return next;
    });
    setRejectedFields((prev) =>
      prev.includes(currentFieldKey) ? prev : [...prev, currentFieldKey],
    );
    markActioned(currentFieldKey);
  }

  function handleSkip() {
    if (!currentFieldKey) return;
    setOverrides((prev) => {
      if (!(currentFieldKey in prev)) return prev;
      const next = { ...prev };
      delete next[currentFieldKey];
      return next;
    });
    setRejectedFields((prev) => prev.filter((f) => f !== currentFieldKey));
    markActioned(currentFieldKey);
  }

  function handlePrev() {
    setPinnedFieldKey(null);
    setCurrentStepIndex((i) => Math.max(0, i - 1));
  }

  function handleNext() {
    setPinnedFieldKey(null);
    setCurrentStepIndex((i) => Math.min(totalFlagged, i + 1));
  }

  function handleSkipToSummary() {
    setPinnedFieldKey(null);
    setCurrentStepIndex(totalFlagged);
  }

  // Always-available header button: steps forward one flagged field at a
  // time, wrapping from the Summary slide back to the first flagged field.
  function handleCycleField() {
    setPinnedFieldKey(null);
    setCurrentStepIndex((i) => (i >= totalFlagged ? 0 : i + 1));
  }

  function handleViewField(fieldKey: string) {
    const flaggedIndex = flaggedFieldKeys.indexOf(fieldKey);
    if (flaggedIndex >= 0) {
      setPinnedFieldKey(null);
      setCurrentStepIndex(flaggedIndex);
    } else {
      setPinnedFieldKey(fieldKey);
    }
  }

  function handleFlagPassed(fieldKey: string) {
    setOverrides((prev) => ({
      ...prev,
      [fieldKey]: { reason: "", decision: "flag" },
    }));
  }

  function handleClearFlag(fieldKey: string) {
    setOverrides((prev) => {
      if (!(fieldKey in prev)) return prev;
      const next = { ...prev };
      delete next[fieldKey];
      return next;
    });
  }

  function goToNextOrExit() {
    const nextId = batchIndex >= 0 ? batchIds[batchIndex + 1] : undefined;
    if (nextId) {
      router.push(`/queue/${nextId}?batch=${batchIds.join(",")}`);
    } else {
      router.push("/");
    }
  }

  async function submitResolution(
    decision: "approved" | "rejected",
    note: string,
  ) {
    if (!app) return;
    setSubmitting(true);
    setSubmitError(null);
    const specialist = getCurrentSpecialist();
    const body = {
      decision,
      overrides: Object.entries(overrides).map(([field, entry]) => ({
        field,
        reason: entry.reason,
        decision: entry.decision,
      })),
      rejectedFields: decision === "rejected" ? rejectedFields : [],
      note: decision === "rejected" ? note : "",
      specialistId: specialist?.id,
    };
    try {
      const res = await fetch(`/api/queue/${app.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error: string };
        throw new Error(data.error);
      }
      goToNextOrExit();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRevert() {
    if (!app) return;
    setReverting(true);
    setRevertError(null);
    try {
      const res = await fetch(`/api/queue/${app.id}/revert`, {
        method: "POST",
      });
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

  if (loading)
    return (
      <div className="px-8 py-8 text-base text-on-surface-muted">
        Loading application…
      </div>
    );
  if (!app)
    return (
      <div className="px-8 py-8 text-base text-bp-error">
        Application not found.
      </div>
    );

  const showStepper = Boolean(app.ocrData) && app.status !== "resolved";

  return (
    <div className="px-8 py-8 max-w-10xl">
      <div className="mb-6 flex items-start justify-between gap-6">
        <div>
          <h1
            className="text-2xl font-bold text-on-surface"
            style={{ fontFamily: "var(--font-inter)" }}>
            {app.applicationData.brandName}
          </h1>
          <p className="text-base text-on-surface-muted mt-1">
            {app.id} · {app.applicant} · submitted{" "}
            {new Date(app.submittedAt).toLocaleString()}
          </p>
          {batchIndex >= 0 && (
            <p className="text-sm text-primary font-medium mt-2">
              Batch review — application {batchIndex + 1} of {batchIds.length}
            </p>
          )}
        </div>
        {app.status === "analyzed" && (
          <div className="shrink-0 text-right">
            <button
              onClick={handleReanalyze}
              disabled={reanalyzing}
              className="cursor-pointer px-4 py-2 border border-outline text-on-surface-dim text-base font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">
              {reanalyzing ? "Re-running OCR…" : "Re-run OCR"}
            </button>
            {reanalyzeError && (
              <p className="text-sm text-bp-error font-semibold mt-2 max-w-xs">
                {reanalyzeError}
              </p>
            )}
          </div>
        )}
      </div>

      {!app.ocrData && (
        <p className="text-base text-on-surface-muted">
          This application has not been analyzed yet. Run pre-analysis from the
          queue screen first.
        </p>
      )}

      {showStepper && (
        <div className="rounded-2xl overflow-hidden border border-outline shadow-sm">
          <FieldStatusStrip
            appId={app.id}
            orderedFields={orderedFields}
            overrides={overrides}
            currentFlaggedIndex={currentStepIndex}
            totalFlagged={totalFlagged}
            atSummary={atSummary}
            selectedFieldKey={displayedFieldKey}
            onSelectField={handleViewField}
            onSkipToSummary={handleSkipToSummary}
            onNextField={handleCycleField}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2">
            <div className="bg-surface-card p-6">
              {displayedField ?
                <LabelRegionPanel
                  images={app.images}
                  fieldLabel={displayedField.label}
                  fieldNumber={displayedFieldNumber}
                  extractedText={displayedField.extracted}
                  boxes={displayedBoxes}
                />
              : <LabelOverviewPanel
                  images={app.images}
                  fields={allFields}
                  boundingBoxes={app.ocrData?.boundingBoxes}
                />
              }
            </div>
            <div className="bg-surface p-6">
              {displayedField && isDisplayedNaturallyFlagged ?
                <FieldReviewCard
                  field={displayedField}
                  boxes={displayedBoxes}
                  severity={effectiveSeverity(
                    displayedField,
                    overrides[displayedField.field],
                  )}
                  currentFlaggedIndex={currentStepIndex}
                  totalFlagged={totalFlagged}
                  reviewedCount={reviewedCount}
                  leftCount={leftCount}
                  markedAction={markedAction}
                  canPrev={currentStepIndex > 0}
                  canNext={currentStepIndex < totalFlagged}
                  onAccept={handleAccept}
                  onReject={handleReject}
                  onSkip={handleSkip}
                  onPrev={handlePrev}
                  onNext={handleNext}
                />
              : displayedField ?
                <PassedFieldPanel
                  field={displayedField}
                  boxes={displayedBoxes}
                  severity={effectiveSeverity(
                    displayedField,
                    overrides[displayedField.field],
                  )}
                  isManuallyFlagged={
                    overrides[displayedField.field]?.decision === "flag"
                  }
                  onFlag={() => handleFlagPassed(displayedField.field)}
                  onClearFlag={() => handleClearFlag(displayedField.field)}
                  onBack={() => setPinnedFieldKey(null)}
                />
              : <ReviewSummaryPanel
                  stillFlagged={stillFlagged}
                  totalFlagged={totalFlagged}
                  getMarkedAction={getMarkedAction}
                  onReviewField={handleViewField}
                  onBackToFields={() => setCurrentStepIndex(0)}
                />
              }
            </div>
          </div>

          <ReviewSummaryBar
            passCount={severityCounts.pass}
            warnCount={severityCounts.warn}
            failCount={severityCounts.fail}
            canApprove={canApprove ?? false}
            canDeny={canDeny}
            submitting={submitting}
            errorMessage={submitError}
            onApprove={() => submitResolution("approved", "")}
            onDenyClick={() => setDenyModalOpen(true)}
          />
        </div>
      )}

      <DenyNoteModal
        open={denyModalOpen}
        submitting={submitting}
        onConfirm={(note) => {
          setDenyModalOpen(false);
          submitResolution("rejected", note);
        }}
        onClose={() => setDenyModalOpen(false)}
      />

      {app.status === "resolved" && app.reviewData.resolution && (
        <div className="mt-8 border-t border-outline pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-base font-medium text-on-surface">
                {app.reviewData.resolution.decision === "approved" ?
                  "Approved"
                : "Rejected"}{" "}
                by{" "}
                {app.reviewData.resolution.specialistId ?
                  specialistNameById(app.reviewData.resolution.specialistId)
                : "Unknown"}
              </p>
              <p className="text-sm text-on-surface-muted mt-1">
                {new Date(
                  app.reviewData.resolution.resolvedAt,
                ).toLocaleString()}
              </p>
              {app.reviewData.resolution.note && (
                <p className="text-base text-on-surface-dim mt-2">
                  {app.reviewData.resolution.note}
                </p>
              )}
            </div>
            <button
              onClick={() => setRevertConfirmOpen(true)}
              className="cursor-pointer px-4 py-2 border border-outline text-on-surface-dim text-base font-semibold rounded-lg">
              Revert to Queue
            </button>
          </div>
          {revertError && (
            <div className="mt-4 bg-bp-error-surface border border-bp-error-border text-bp-error rounded-lg px-4 py-3 text-base">
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
