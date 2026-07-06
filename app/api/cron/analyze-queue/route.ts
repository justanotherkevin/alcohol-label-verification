import { timingSafeEqual } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { unanalyzedApplications, recordBatchRun } from "@/lib/queue/store"
import { runAnalysis } from "@/lib/queue/analyze"

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  const authHeader = req.headers.get("authorization")
  if (!secret || !authHeader) return false

  const expected = Buffer.from(`Bearer ${secret}`)
  const actual = Buffer.from(authHeader)
  if (expected.length !== actual.length) return false
  return timingSafeEqual(expected, actual)
}

// Invoked by Vercel Cron (see vercel.json); Vercel attaches
// `Authorization: Bearer ${CRON_SECRET}` to scheduled requests when
// CRON_SECRET is set as a project env var, which is what we check for here.
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const pending = await unanalyzedApplications()
  const analyzedIds = await runAnalysis(pending, "tesseract")
  if (analyzedIds.length > 0) {
    await recordBatchRun("cron", analyzedIds.length)
  }

  return NextResponse.json({ analyzedIds })
}
