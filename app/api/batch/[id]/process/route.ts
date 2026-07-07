import { NextRequest, NextResponse } from "next/server"
import { processBatchChunk } from "@/lib/batch/runner"
import { completeSubmissionBatch, getSubmissionBatch } from "@/lib/queue/store"

const CHUNK_SIZE = 20

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const batch = await getSubmissionBatch(id)
  if (!batch) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 })
  }

  const providerName = req.headers.get("X-Ocr-Provider") ?? batch.ocrProvider
  const apiKey = req.headers.get("X-Api-Key") ?? undefined

  const result = await processBatchChunk(id, CHUNK_SIZE, providerName, apiKey)
  if (result.remaining === 0) {
    await completeSubmissionBatch(id)
  }

  return NextResponse.json(result)
}
