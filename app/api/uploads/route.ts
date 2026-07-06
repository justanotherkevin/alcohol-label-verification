import { put } from "@vercel/blob"
import { NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"
import { ALLOWED_IMAGE_MIME_TYPES, EXTENSION_BY_MIME_TYPE } from "@/lib/uploads"

const MAX_BYTES = 8 * 1024 * 1024

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
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "file too large (max 8MB)" }, { status: 400 })
  }

  // Filename is derived entirely from server-generated values (never file.name,
  // which is client-controlled) to rule out path traversal in the local-disk
  // fallback below.
  const filename = `${crypto.randomUUID()}.${EXTENSION_BY_MIME_TYPE[file.type]}`

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    // On Vercel, the deployed filesystem is read-only (writing into public/
    // throws ENOENT) — there's no local disk to fall back to, so surface a
    // clear error instead of crashing. Only plain `next dev` gets the
    // zero-setup local-disk fallback; Vercel deployments get the token
    // injected automatically once a Blob store is connected to the project.
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
