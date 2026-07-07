import { analyzeApplication } from "@/lib/queue/analyze"
import { isFieldFlagged } from "@/lib/queue/field-status"
import {
  countPendingBatchApplications,
  getApplication,
  pendingBatchApplicationIds,
  resolveApplication,
  updateApplication,
} from "@/lib/queue/store"
import { LabelImage, OcrData } from "@/lib/queue/types"
import { storeImageBuffer } from "@/lib/uploads"
import { fetchExternalImageSafely } from "@/lib/uploads/fetch-external-image"
import { runWithConcurrency } from "./pool"

const CONCURRENCY_LIMIT = 6

/** Clean iff no field needs review — mirrors the same predicate `listQueue`
 * already uses to compute flag counts (`lib/queue/store.ts`). */
export function classifyAnalyzedRow(ocrData: OcrData): "clean" | "flagged" {
  return ocrData.result.fields.filter(isFieldFlagged).length === 0 ? "clean" : "flagged"
}

async function rehostImage(image: LabelImage): Promise<LabelImage> {
  const { buffer, mimeType } = await fetchExternalImageSafely(image.path)
  const path = await storeImageBuffer(buffer, mimeType)
  return { ...image, path, mimeType }
}

async function processOneApplication(
  id: string,
  providerName: string,
  apiKey?: string
): Promise<{ id: string; brandName: string; verdict: "clean" | "flagged" | "error"; error?: string }> {
  const app = await getApplication(id)
  if (!app) {
    return { id, brandName: "", verdict: "error", error: "Application not found" }
  }

  try {
    const rehostedImages = await Promise.all(app.images.map(rehostImage))
    const { ocrData, images } = await analyzeApplication(
      { ...app, images: rehostedImages },
      providerName,
      apiKey
    )
    await updateApplication(id, { images, ocrData })

    const verdict = classifyAnalyzedRow(ocrData)
    if (verdict === "clean") {
      await resolveApplication(id, {
        decision: "approved",
        overrides: [],
        rejectedFields: [],
        note: "Auto-approved: clean AI pass (batch upload)",
        resolvedAt: new Date().toISOString(),
      })
    } else {
      await updateApplication(id, { status: "analyzed" })
    }

    return { id, brandName: app.applicationData.brandName, verdict }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error during batch processing"
    await updateApplication(id, { errorMessage: message })
    return { id, brandName: app.applicationData.brandName, verdict: "error", error: message }
  }
}

export interface ChunkResult {
  processed: number
  remaining: number
  results: Array<{ id: string; brandName: string; verdict: "clean" | "flagged" | "error"; error?: string }>
}

/** Processes up to `chunkSize` still-pending rows for a batch through a
 * concurrency-limited pool. Always re-derives "what's left" from the DB
 * (via `pendingBatchApplicationIds`), so this is safe to call repeatedly
 * and resumable across page reloads or client restarts. */
export async function processBatchChunk(
  batchId: string,
  chunkSize: number,
  providerName: string,
  apiKey?: string
): Promise<ChunkResult> {
  const ids = await pendingBatchApplicationIds(batchId, chunkSize)
  const poolResults = await runWithConcurrency(ids, CONCURRENCY_LIMIT, (id) =>
    processOneApplication(id, providerName, apiKey)
  )

  const results = poolResults.map((r) =>
    r.ok ? r.value : { id: "", brandName: "", verdict: "error" as const, error: String(r.error) }
  )

  const remaining = await countPendingBatchApplications(batchId)
  return {
    processed: ids.length,
    remaining,
    results,
  }
}
