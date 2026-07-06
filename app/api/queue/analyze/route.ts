import { NextRequest, NextResponse } from "next/server"
import { getApplication, unanalyzedApplications, recordBatchRun } from "@/lib/queue/store"
import { runAnalysis } from "@/lib/queue/analyze"
import { QueueApplication } from "@/lib/queue/types"

export async function POST(req: NextRequest) {
  const providerName = req.headers.get("X-Ocr-Provider") ?? "tesseract"
  const apiKey = req.headers.get("X-Api-Key") ?? undefined

  let pending
  const body = await req.json().catch(() => null) as { ids?: string[] } | null
  if (body?.ids) {
    const apps = await Promise.all(body.ids.map((id) => getApplication(id)))
    pending = apps.filter(
      (app): app is QueueApplication => app !== undefined && app.status === "pending"
    )
  } else {
    pending = await unanalyzedApplications()
  }

  const analyzedIds = await runAnalysis(pending, providerName, apiKey)
  if (analyzedIds.length > 0) {
    await recordBatchRun("manual", analyzedIds.length)
  }

  return NextResponse.json({ analyzedIds })
}
