import { NextRequest, NextResponse } from "next/server"
import { getApplication, unanalyzedApplications, updateApplication } from "@/lib/queue/store"
import { analyzeApplication } from "@/lib/queue/analyze"
import { QueueApplication } from "@/lib/queue/types"

export async function POST(req: NextRequest) {
  const providerName = req.headers.get("X-Ocr-Provider") ?? "mock"
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
  const analyzedIds: string[] = []

  for (const app of pending) {
    const { ocrData, images } = await analyzeApplication(app, providerName, apiKey)
    await updateApplication(app.id, { status: "analyzed", ocrData, images })
    analyzedIds.push(app.id)
  }

  return NextResponse.json({ analyzedIds })
}
