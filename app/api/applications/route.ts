import { NextResponse } from "next/server"
import { addApplication } from "@/lib/queue/store"
import { loadMockImage } from "@/lib/queue/load-image"
import { LABEL_CATALOG } from "@/lib/queue/label-catalog"
import { QueueApplication } from "@/lib/queue/types"
import { ApplicationData } from "@/lib/verify"
import { ALLOWED_IMAGE_MIME_TYPES, isTrustedUploadPath } from "@/lib/uploads"

export async function POST(request: Request) {
  const body = (await request.json()) as {
    applicant?: string
    catalogKey?: string
    applicationData?: Partial<ApplicationData>
    imageOverrides?: Record<number, { path: string; mimeType: string }>
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

  // Overrides must point at a URL we actually wrote ourselves (our local-dev
  // fallback or a Vercel Blob public store) — analysis later fetches img.path
  // over HTTP, so accepting an arbitrary client-supplied URL here would let a
  // submission turn the server into an SSRF proxy.
  const overrides = body.imageOverrides ?? {}
  for (const override of Object.values(overrides)) {
    if (!isTrustedUploadPath(override.path) || !ALLOWED_IMAGE_MIME_TYPES.has(override.mimeType)) {
      return NextResponse.json({ error: "invalid imageOverrides" }, { status: 400 })
    }
  }

  // A replaced photo drops the demo catalog's precomputed OCR vision text —
  // it belongs to a different image now — but untouched slots keep it.
  const images = entry.imageKeys.map((imgKey, i) => {
    const override = overrides[i]
    if (override?.path) {
      return { ...loadMockImage(imgKey), path: override.path, mimeType: override.mimeType, rawOcrText: undefined }
    }
    return loadMockImage(imgKey)
  })

  const app: QueueApplication = {
    id: `demo-TTB-2026-${Date.now()}`,
    applicant,
    submittedAt: new Date().toISOString(),
    images,
    applicationData: submitted,
    ocrData: null,
    status: "pending",
    reviewData: { sessions: [], fieldNotes: [], resolution: null },
  }

  await addApplication(app)
  return NextResponse.json({ id: app.id }, { status: 201 })
}
