import { NextResponse } from "next/server"
import { resetQueue } from "@/lib/queue/store"
import { regenerateExtracted } from "@/lib/queue/regenerate-extracted"

export async function DELETE() {
  regenerateExtracted()
  resetQueue()
  return NextResponse.json({ ok: true })
}
