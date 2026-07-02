import { NextResponse } from "next/server"
import { resetQueue } from "@/lib/queue/store"

export async function DELETE() {
  resetQueue()
  return NextResponse.json({ ok: true })
}
