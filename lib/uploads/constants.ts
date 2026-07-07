// Pure constants only — no Node built-ins or server-only SDKs — so this
// module is safe to import from client components as well as server code.
// lib/uploads.ts (server-only: fs, path, @vercel/blob) re-exports these for
// existing server-side callers.

export const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])

export const MAX_IMAGE_BYTES = 1 * 1024 * 1024

export const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}
