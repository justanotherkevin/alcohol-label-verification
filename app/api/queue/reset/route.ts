import { NextResponse } from "next/server"
import { resetQueue } from "@/lib/queue/store"
import { regenerateExtracted } from "@/lib/queue/regenerate-extracted"
import { isProductionEnvironment } from "@/lib/env"

export async function DELETE() {
  // regenerateExtracted() writes tests/mocks/labels/_extracted.json to disk,
  // which fails on Vercel's read-only production filesystem — it's a dev
  // convenience for picking up local vision.json fixture edits, not needed
  // in production since _extracted.json is already committed.
  if (!isProductionEnvironment()) {
    regenerateExtracted()
  }
  await resetQueue()
  return NextResponse.json({ ok: true })
}
