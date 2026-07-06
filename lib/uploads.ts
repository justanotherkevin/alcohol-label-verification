export const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])

export const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}

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
