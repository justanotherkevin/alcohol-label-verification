import { NextRequest, NextResponse } from "next/server"
import { unanalyzedApplications, updateApplication } from "@/lib/queue/store"
import { analyzeApplication } from "@/lib/queue/analyze"

export async function POST(req: NextRequest) {
  const providerName = req.headers.get("X-Ocr-Provider") ?? "mock"
  const apiKey = req.headers.get("X-Api-Key") ?? undefined

  const pending = unanalyzedApplications()
  const analyzedIds: string[] = []

  for (const app of pending) {
    const { ocrData, images } = await analyzeApplication(app, providerName, apiKey)
    updateApplication(app.id, { status: "analyzed", ocrData, images })
    analyzedIds.push(app.id)
  }

  return NextResponse.json({ analyzedIds })
}
