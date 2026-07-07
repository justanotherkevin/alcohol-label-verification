import { put } from "@vercel/blob"
import fs from "fs/promises"
import path from "path"

import { EXTENSION_BY_MIME_TYPE } from "./uploads/constants"

export { ALLOWED_IMAGE_MIME_TYPES, MAX_IMAGE_BYTES, EXTENSION_BY_MIME_TYPE } from "./uploads/constants"

// An application's imageOverrides must point at somewhere we actually wrote the
// file to ourselves: our local-dev fallback (public/uploads) or a Vercel Blob
// public store URL. Anything else is rejected — otherwise the OCR analysis
// step (which fetches img.path over HTTP) could be used as an SSRF proxy for
// an attacker-chosen URL.
export function isTrustedUploadPath(value: string): boolean {
  if (value.startsWith("/uploads/")) return true
  try {
    const url = new URL(value)
    return url.protocol === "https:" && /\.public\.blob\.vercel-storage\.com$/.test(url.hostname)
  } catch {
    return false
  }
}

/** Persists an already-validated image buffer to our own trusted storage
 * (Vercel Blob if connected, else a local-dev public/uploads fallback) and
 * returns a URL that satisfies `isTrustedUploadPath`. Shared by the
 * single-photo upload route and the batch-upload image re-hosting step. */
export async function storeImageBuffer(buffer: Buffer, mimeType: string): Promise<string> {
  const filename = `${crypto.randomUUID()}.${EXTENSION_BY_MIME_TYPE[mimeType]}`
  const hasBlobStoreConnected = Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID)

  if (!hasBlobStoreConnected) {
    if (process.env.VERCEL) {
      throw new Error("Image storage needs a Blob store connected to this Vercel project.")
    }
    const uploadsDir = path.join(process.cwd(), "public", "uploads")
    await fs.mkdir(uploadsDir, { recursive: true })
    await fs.writeFile(path.join(uploadsDir, filename), buffer)
    return `/uploads/${filename}`
  }

  const blob = await put(`label-photos/${filename}`, buffer, {
    access: "public",
    addRandomSuffix: true,
    contentType: mimeType,
  })
  return blob.url
}
