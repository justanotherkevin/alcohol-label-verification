import dns from "dns"
import { ALLOWED_IMAGE_MIME_TYPES, MAX_IMAGE_BYTES } from "@/lib/uploads/constants"

const FETCH_TIMEOUT_MS = 10_000

export class UntrustedImageUrlError extends Error {}

// Batch-upload image URLs are importer-supplied and fetched server-side, so
// unlike the rest of this app's uploads (which only ever touch our own Blob
// storage / local disk, see isTrustedUploadPath), this is a genuine SSRF
// surface: a malicious CSV row could point at an internal service or the
// cloud metadata endpoint. This check happens once via DNS lookup before the
// actual fetch; a sufficiently motivated attacker could still race a
// DNS-rebinding attack between this check and fetch() resolving the hostname
// again, since fetch() doesn't support pinning to an already-resolved IP
// without a custom agent. Acceptable residual risk for a prototype; real
// hardening would connect directly to the checked IP.
function isPrivateOrReservedIp(address: string, family: number): boolean {
  if (family === 4) {
    const [a, b] = address.split(".").map(Number)
    if (a === 127) return true // loopback
    if (a === 10) return true // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true // 172.16.0.0/12
    if (a === 192 && b === 168) return true // 192.168.0.0/16
    if (a === 169 && b === 254) return true // link-local, incl. 169.254.169.254 metadata
    if (a === 0) return true // 0.0.0.0/8
    return false
  }
  const lower = address.toLowerCase()
  if (lower === "::1") return true // loopback
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true // fc00::/7 unique local
  if (/^fe[89ab]/.test(lower)) return true // fe80::/10 link-local
  return false
}

function matchesMagicBytes(buffer: Buffer, mimeType: string): boolean {
  if (mimeType === "image/jpeg") {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  }
  if (mimeType === "image/png") {
    return (
      buffer.length >= 4 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    )
  }
  if (mimeType === "image/webp") {
    return (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP"
    )
  }
  return false
}

// Narrow, explicitly-named escape hatch so Playwright E2E specs can point
// front_image_url/back_image_url at fixtures served by the same plain-http
// localhost dev server (which has no TLS). Only ever set by
// playwright.config.ts's webServer.env for the process it launches — never
// set in production or a normal `npm run dev`.
function loopbackFetchAllowedInTests(): boolean {
  return process.env.ALLOW_LOOPBACK_FETCH_IN_TESTS === "true"
}

async function assertResolvesToPublicAddress(hostname: string): Promise<void> {
  if (loopbackFetchAllowedInTests()) return
  const addresses = await dns.promises.lookup(hostname, { all: true })
  for (const addr of addresses) {
    if (isPrivateOrReservedIp(addr.address, addr.family)) {
      throw new UntrustedImageUrlError(
        `URL hostname "${hostname}" resolves to a private/reserved address`
      )
    }
  }
}

export interface FetchedImage {
  buffer: Buffer
  mimeType: string
}

/** Fetches an importer-supplied image URL with SSRF-safe validation: HTTPS-only,
 * blocks private/loopback/link-local resolved addresses, enforces a fetch
 * timeout, checks the declared content-type against an allowlist, enforces a
 * streamed size cap (not trusting Content-Length), and sniffs magic bytes as
 * defense-in-depth against a spoofed content-type header. */
export async function fetchExternalImageSafely(url: string): Promise<FetchedImage> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new UntrustedImageUrlError(`Invalid URL: ${url}`)
  }
  const allowedProtocol =
    parsed.protocol === "https:" || (loopbackFetchAllowedInTests() && parsed.protocol === "http:")
  if (!allowedProtocol) {
    throw new UntrustedImageUrlError(`Only https:// URLs are allowed: ${url}`)
  }

  await assertResolvesToPublicAddress(parsed.hostname)

  const response = await fetch(parsed.toString(), {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!response.ok) {
    throw new UntrustedImageUrlError(`Failed to fetch image (HTTP ${response.status}): ${url}`)
  }

  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() ?? ""
  if (!ALLOWED_IMAGE_MIME_TYPES.has(contentType)) {
    throw new UntrustedImageUrlError(`Unsupported content-type "${contentType}": ${url}`)
  }
  if (!response.body) {
    throw new UntrustedImageUrlError(`Empty response body: ${url}`)
  }

  const reader = response.body.getReader()
  const chunks: Buffer[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      total += value.length
      if (total > MAX_IMAGE_BYTES) {
        await reader.cancel()
        throw new UntrustedImageUrlError(`Image exceeds ${MAX_IMAGE_BYTES} byte limit: ${url}`)
      }
      chunks.push(Buffer.from(value))
    }
  }
  const buffer = Buffer.concat(chunks)

  if (!matchesMagicBytes(buffer, contentType)) {
    throw new UntrustedImageUrlError(`File content does not match declared type "${contentType}": ${url}`)
  }

  return { buffer, mimeType: contentType }
}
