import { NextResponse } from "next/server"
import { flaggedBatchApplicationIds, getBatchCounts, getSubmissionBatch } from "@/lib/queue/store"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const batch = await getSubmissionBatch(id)
  if (!batch) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 })
  }
  const counts = await getBatchCounts(id)
  const flaggedIds = await flaggedBatchApplicationIds(id)
  return NextResponse.json({ batch, counts, flaggedIds })
}
