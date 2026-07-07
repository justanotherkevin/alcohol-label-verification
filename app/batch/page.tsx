"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { BatchSummaryBar } from "@/components/batch/BatchSummaryBar";
import { CsvDropzone } from "@/components/batch/CsvDropzone";
import { Toast } from "@/components/Toast";
import { PROVIDER_LABELS } from "@/lib/ocr/provider-labels";

const SETTINGS_KEY = "ttb-ocr-settings";

interface CsvRowError {
  row: number;
  message: string;
}

interface RowResult {
  id: string;
  brandName: string;
  verdict: "clean" | "flagged" | "error";
  error?: string;
}

interface BatchCounts {
  total: number;
  pending: number;
  flagged: number;
  clean: number;
  resolvedApproved: number;
  resolvedRejected: number;
  errors: number;
}

const VERDICT_STYLE: Record<RowResult["verdict"], string> = {
  clean: "bg-bp-success-surface text-bp-success border-bp-success-border",
  flagged: "bg-bp-warning-surface text-bp-warning border-bp-warning-border",
  error: "bg-bp-error-surface text-bp-error border-bp-error-border",
};

const VERDICT_LABEL: Record<RowResult["verdict"], string> = {
  clean: "Clean pass",
  flagged: "Needs review",
  error: "Error",
};

export default function BatchUploadPage() {
  return (
    <Suspense fallback={null}>
      <BatchUploadPageInner />
    </Suspense>
  );
}

function BatchUploadPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const batchId = searchParams.get("id");

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [skippedRows, setSkippedRows] = useState<CsvRowError[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [counts, setCounts] = useState<BatchCounts | null>(null);
  const [results, setResults] = useState<RowResult[]>([]);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState<"processing" | "completed" | null>(null);
  const [flaggedIds, setFlaggedIds] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const processingRef = useRef(false);

  function providerId(): string {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      const parsed = raw ? (JSON.parse(raw) as { provider?: string }) : {};
      return parsed.provider ?? "tesseract";
    } catch {
      return "tesseract";
    }
  }

  function providerHeaders(): Record<string, string> {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      const parsed = raw ? (JSON.parse(raw) as { provider?: string; apiKey?: string }) : {};
      return {
        "X-Ocr-Provider": parsed.provider ?? "tesseract",
        ...(parsed.apiKey ? { "X-Api-Key": parsed.apiKey } : {}),
      };
    } catch {
      return { "X-Ocr-Provider": "tesseract" };
    }
  }

  const refreshCounts = useCallback(async (id: string) => {
    const res = await fetch(`/api/batch/${id}`);
    if (!res.ok) return;
    const data = (await res.json()) as {
      batch: { totalCount: number; status: "processing" | "completed" };
      counts: BatchCounts;
      flaggedIds: string[];
    };
    setTotalCount(data.batch.totalCount);
    setStatus(data.batch.status);
    setCounts(data.counts);
    setFlaggedIds(data.flaggedIds);
  }, []);

  const runProcessLoop = useCallback(
    async (id: string) => {
      if (processingRef.current) return;
      processingRef.current = true;
      setProcessing(true);
      const provider = providerId();
      setToastMessage(`Processing batch with ${PROVIDER_LABELS[provider] ?? provider}…`);
      try {
        while (true) {
          const res = await fetch(`/api/batch/${id}/process`, {
            method: "POST",
            headers: providerHeaders(),
          });
          if (!res.ok) break;
          const data = (await res.json()) as {
            remaining: number;
            results: RowResult[];
          };
          setResults((prev) => [...prev, ...data.results]);
          await refreshCounts(id);
          if (data.remaining === 0) break;
        }
      } finally {
        processingRef.current = false;
        setProcessing(false);
      }
    },
    [refreshCounts]
  );

  useEffect(() => {
    if (!batchId) return;
    refreshCounts(batchId).then(() => runProcessLoop(batchId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId]);

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    setSkippedRows([]);
    setResults([]);

    const form = new FormData();
    form.append("file", file);

    const res = await fetch("/api/batch", {
      method: "POST",
      headers: providerHeaders(),
      body: form,
    });
    const data = await res.json();
    setUploading(false);

    if (!res.ok) {
      setUploadError(data.error ?? "Upload failed");
      setSkippedRows(data.skippedRows ?? []);
      return;
    }

    setSkippedRows(data.skippedRows ?? []);
    setTotalCount(data.totalCount);
    router.push(`/batch?id=${data.batchId}`);
  }

  const processedCount = counts ? counts.total - counts.pending : 0;

  function handleStartBatchReview() {
    if (flaggedIds.length === 0) return;
    router.push(`/queue/${flaggedIds[0]}?batch=${flaggedIds.join(",")}`);
  }

  if (!batchId) {
    return (
      <div className="px-8 py-8 max-w-2xl">
        <div className="mb-8">
          <h1
            className="text-3xl font-bold text-on-surface"
            style={{ fontFamily: "var(--font-inter)" }}>
            Batch Upload
          </h1>
          <p className="text-base text-on-surface-muted mt-2">
            Upload a CSV of label applications — one row per application, with
            columns for brand name, class/type, ABV, net contents, bottler
            info, country of origin, government warning text, and image URLs
            (front required, back optional). Each row&apos;s images are
            fetched from the URLs you provide.
          </p>
          <a
            href="/batch-template.csv"
            download
            className="inline-block mt-3 text-base font-semibold text-primary hover:underline">
            Download CSV template
          </a>
        </div>

        <div className="space-y-4">
          <CsvDropzone file={file} onFileSelected={setFile} disabled={uploading} />

          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="w-full px-5 py-3 bg-primary text-white text-base font-semibold rounded-lg hover:bg-primary-hover transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {uploading && (
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            )}
            {uploading ? "Uploading…" : "Upload and process"}
          </button>

          {uploadError && (
            <p className="text-base text-bp-error font-semibold">{uploadError}</p>
          )}
          {skippedRows.length > 0 && (
            <div className="text-base text-bp-warning">
              <p className="font-semibold">{skippedRows.length} row(s) skipped:</p>
              <ul className="list-disc pl-6 mt-1 space-y-1">
                {skippedRows.map((e, i) => (
                  <li key={i}>
                    Row {e.row}: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="px-8 py-8 max-w-4xl">
      {toastMessage && (
        <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
      )}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1
            className="text-3xl font-bold text-on-surface"
            style={{ fontFamily: "var(--font-inter)" }}>
            Batch Upload
          </h1>
          <p className="text-base text-on-surface-muted mt-2">
            {status === "completed"
              ? "Processing complete."
              : `Processing ${processedCount} / ${totalCount}…`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {status === "completed" && flaggedIds.length > 0 && (
            <button
              onClick={handleStartBatchReview}
              className="px-4 py-2.5 bg-primary text-white rounded-lg text-base font-semibold hover:bg-primary-hover transition-colors cursor-pointer">
              Start batch review ({flaggedIds.length})
            </button>
          )}
          <a
            href={`/api/batch/${batchId}/export`}
            className="px-4 py-2.5 border-2 border-outline rounded-lg text-base font-semibold text-on-surface-dim hover:bg-surface-dim transition-colors">
            Download results CSV
          </a>
          <Link
            href="/batch"
            className="px-4 py-2.5 border-2 border-outline rounded-lg text-base font-semibold text-on-surface-dim hover:bg-surface-dim transition-colors">
            New upload
          </Link>
        </div>
      </div>

      {skippedRows.length > 0 && (
        <div className="mb-4 text-base text-bp-warning">
          <p className="font-semibold">{skippedRows.length} row(s) skipped from the CSV:</p>
          <ul className="list-disc pl-6 mt-1 space-y-1">
            {skippedRows.map((e, i) => (
              <li key={i}>
                Row {e.row}: {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {counts && (
        <div className="mb-6">
          <BatchSummaryBar
            total={counts.total}
            passed={counts.clean + counts.resolvedApproved}
            rejected={counts.resolvedRejected}
            pendingReview={counts.flagged}
            errors={counts.errors}
          />
        </div>
      )}

      <div className="rounded-lg border border-outline bg-surface-card overflow-hidden">
        <table className="w-full text-base">
          <thead className="bg-surface-dim border-b border-outline">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-on-surface-dim">
                Brand Name
              </th>
              <th className="text-left px-4 py-3 font-semibold text-on-surface-dim">
                Verdict
              </th>
              <th className="text-left px-4 py-3 font-semibold text-on-surface-dim">
                Details
              </th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => (
              <tr key={`${r.id}-${i}`} className="border-b border-outline last:border-b-0">
                <td className="px-4 py-3 text-on-surface">{r.brandName || r.id}</td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2.5 py-1 rounded-full text-sm font-semibold border ${VERDICT_STYLE[r.verdict]}`}>
                    {VERDICT_LABEL[r.verdict]}
                  </span>
                </td>
                <td className="px-4 py-3 text-on-surface-muted">
                  {r.verdict === "flagged" && (
                    <Link href={`/queue/${r.id}`} className="text-primary hover:underline">
                      Review in queue →
                    </Link>
                  )}
                  {r.verdict === "error" && r.error}
                </td>
              </tr>
            ))}
            {results.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-on-surface-muted">
                  {processing ? "Processing…" : "No results yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
