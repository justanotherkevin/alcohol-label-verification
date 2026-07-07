import { NextResponse } from "next/server"
import { parseBatchCsv, MAX_CSV_BYTES } from "@/lib/batch/csv"
import { addApplication, createSubmissionBatch } from "@/lib/queue/store"
import { QueueApplication } from "@/lib/queue/types"

export async function POST(request: Request) {
  // No OCR happens on this route — the provider is only recorded here for
  // display, and the client resends its own X-Ocr-Provider/X-Api-Key headers
  // on each /process call (same convention as app/api/queue/analyze/route.ts).
  const providerName = request.headers.get("X-Ocr-Provider") ?? "tesseract"

  const form = await request.formData()
  const file = form.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 })
  }
  if (file.size > MAX_CSV_BYTES) {
    return NextResponse.json({ error: "CSV file too large (max 2MB)" }, { status: 400 })
  }

  const text = await file.text()
  const { rows, errors } = parseBatchCsv(text)

  if (rows.length === 0) {
    return NextResponse.json({ error: "No valid rows to process", skippedRows: errors }, { status: 400 })
  }

  const batchId = `batch-${crypto.randomUUID()}`
  const now = new Date().toISOString()

  // Row inserts reference this batch via a foreign key, so the batch row
  // must exist first.
  await createSubmissionBatch({
    id: batchId,
    filename: file.name || null,
    totalCount: rows.length,
    ocrProvider: providerName,
    skippedRows: errors,
  })

  // Pure DB writes, no OCR/network calls here — this route stays fast
  // regardless of batch size. Image URLs are only fetched/re-hosted during
  // chunk processing (lib/batch/runner.ts), not here.
  for (const [i, row] of rows.entries()) {
    const app: QueueApplication = {
      id: `${batchId}-row-${i}`,
      applicant: row.applicationData.bottler || "Batch import",
      submittedAt: now,
      images: [
        { path: row.frontImageUrl, mimeType: "", side: "front" },
        ...(row.backImageUrl ? [{ path: row.backImageUrl, mimeType: "", side: "back" as const }] : []),
      ],
      applicationData: row.applicationData,
      ocrData: null,
      status: "pending",
      reviewData: { sessions: [], fieldNotes: [], resolution: null },
      batchId,
    }
    await addApplication(app)
  }

  return NextResponse.json({ batchId, totalCount: rows.length, skippedRows: errors }, { status: 201 })
}
