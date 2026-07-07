import { put } from "@vercel/blob"
import { NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"
import { ALLOWED_IMAGE_MIME_TYPES, EXTENSION_BY_MIME_TYPE, MAX_IMAGE_BYTES } from "@/lib/uploads"

async function saveToLocalUploadsDir(file: File, filename: string): Promise<string> {
  const uploadsDir = path.join(process.cwd(), "public", "uploads")
  await fs.mkdir(uploadsDir, { recursive: true })
  await fs.writeFile(path.join(uploadsDir, filename), Buffer.from(await file.arrayBuffer()))
  return `/uploads/${filename}`
}

export async function POST(request: Request) {
  const form = await request.formData()
  const file = form.get("file")

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 })
  }
  if (!ALLOWED_IMAGE_MIME_TYPES.has(file.type)) {
    return NextResponse.json({ error: "unsupported image type" }, { status: 400 })
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "file too large (max 1MB)" }, { status: 400 })
  }

  // Filename is derived entirely from server-generated values (never file.name,
  // which is client-controlled) to rule out path traversal in the local-disk
  // fallback below.
  const filename = `${crypto.randomUUID()}.${EXTENSION_BY_MIME_TYPE[file.type]}`

  // A connected Blob store shows up as either a static BLOB_READ_WRITE_TOKEN
  // or (the newer, recommended way) BLOB_STORE_ID paired with a
  // Vercel-populated VERCEL_OIDC_TOKEN — @vercel/blob's put() resolves
  // whichever is present on its own, so we only need to check that *some*
  // form of Blob auth exists before calling it.
  const hasBlobStoreConnected = Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID)

  if (!hasBlobStoreConnected) {
    // On Vercel, the deployed filesystem is read-only (writing into public/
    // throws ENOENT) — there's no local disk to fall back to, so surface a
    // clear error instead of crashing. Only plain `next dev` gets the
    // zero-setup local-disk fallback; Vercel deployments get Blob auth
    // injected automatically once a store is connected to the project.
    if (process.env.VERCEL) {
      return NextResponse.json(
        { error: "Photo uploads need a Blob store connected to this Vercel project." },
        { status: 500 }
      )
    }
    const url = await saveToLocalUploadsDir(file, filename)
    return NextResponse.json({ url, mimeType: file.type }, { status: 201 })
  }

  const blob = await put(`label-photos/${filename}`, file, {
    access: "public",
    addRandomSuffix: true,
  })

  return NextResponse.json({ url: blob.url, mimeType: file.type }, { status: 201 })
}
