import { NextResponse } from "next/server"
import { addApplication } from "@/lib/queue/store"
import { loadMockImage } from "@/lib/queue/load-image"
import { LABEL_CATALOG } from "@/lib/queue/label-catalog"
import { QueueApplication } from "@/lib/queue/types"
import { ApplicationData } from "@/lib/verify"

export async function POST(request: Request) {
  const body = (await request.json()) as {
    applicant?: string
    catalogKey?: string
    applicationData?: Partial<ApplicationData>
  }
  const applicant = body.applicant?.trim()
  const catalogKey = body.catalogKey

  if (!applicant) {
    return NextResponse.json({ error: "applicant is required" }, { status: 400 })
  }

  const entry = LABEL_CATALOG.find((e) => e.key === catalogKey)
  if (!entry) {
    return NextResponse.json({ error: "unknown catalogKey" }, { status: 400 })
  }

  // The applicant can edit the auto-filled fields client-side (e.g. to demo a
  // mismatch), so merge over the catalog's ground truth rather than trusting
  // the client wholesale. Empty strings are a legitimate value here (e.g. a
  // field genuinely absent from the application), so only type is checked.
  const edits = body.applicationData ?? {}
  const submitted: ApplicationData = { ...entry.applicationData }
  for (const key of Object.keys(entry.applicationData) as (keyof ApplicationData)[]) {
    if (typeof edits[key] === "string") submitted[key] = edits[key] as string
  }

  const app: QueueApplication = {
    id: `demo-TTB-2026-${Date.now()}`,
    applicant,
    submittedAt: new Date().toISOString(),
    images: entry.imageKeys.map(loadMockImage),
    applicationData: submitted,
    ocrData: null,
    status: "pending",
    reviewData: { sessions: [], fieldNotes: [], resolution: null },
  }

  await addApplication(app)
  return NextResponse.json({ id: app.id }, { status: 201 })
}
