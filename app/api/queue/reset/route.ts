import { NextResponse } from "next/server"
import { resetQueue } from "@/lib/queue/store"
import { regenerateExtracted } from "@/lib/queue/regenerate-extracted"
import { isProductionEnvironment } from "@/lib/env"

export async function DELETE() {
  if (isProductionEnvironment()) {
    return NextResponse.json(
      { error: "Resetting seed data is disabled in production." },
      { status: 403 },
    )
  }
  regenerateExtracted()
  await resetQueue()
  return NextResponse.json({ ok: true })
}
