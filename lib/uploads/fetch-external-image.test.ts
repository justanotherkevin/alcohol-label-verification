import { describe, it, expect, vi, afterEach } from "vitest"

vi.mock("dns", () => ({
  default: {
    promises: {
      lookup: vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]),
    },
  },
}))

import dns from "dns"
import { MAX_IMAGE_BYTES } from "@/lib/uploads"
import { fetchExternalImageSafely, UntrustedImageUrlError } from "./fetch-external-image"

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0])

function mockFetchOnce(response: Response) {
  vi.spyOn(global, "fetch").mockResolvedValueOnce(response)
}

function responseWithBody(buffer: Buffer, contentType: string): Response {
  return new Response(buffer, { status: 200, headers: { "content-type": contentType } })
}

describe("fetchExternalImageSafely", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("rejects non-https URLs", async () => {
    await expect(fetchExternalImageSafely("http://example.com/a.png")).rejects.toThrow(
      UntrustedImageUrlError
    )
  })

  it("rejects a hostname that resolves to a private address", async () => {
    vi.mocked(dns.promises.lookup).mockResolvedValueOnce([{ address: "10.0.0.5", family: 4 }] as never)
    await expect(fetchExternalImageSafely("https://internal.example.com/a.png")).rejects.toThrow(
      UntrustedImageUrlError
    )
  })

  it("rejects a hostname that resolves to the cloud metadata address", async () => {
    vi.mocked(dns.promises.lookup).mockResolvedValueOnce([
      { address: "169.254.169.254", family: 4 },
    ] as never)
    await expect(fetchExternalImageSafely("https://metadata.example.com/a.png")).rejects.toThrow(
      UntrustedImageUrlError
    )
  })

  it("rejects a disallowed content-type", async () => {
    mockFetchOnce(responseWithBody(PNG_SIGNATURE, "application/pdf"))
    await expect(fetchExternalImageSafely("https://example.com/a.pdf")).rejects.toThrow(
      UntrustedImageUrlError
    )
  })

  it("rejects a body whose magic bytes don't match the declared content-type", async () => {
    mockFetchOnce(responseWithBody(JPEG_SIGNATURE, "image/png"))
    await expect(fetchExternalImageSafely("https://example.com/a.png")).rejects.toThrow(
      UntrustedImageUrlError
    )
  })

  it("rejects a non-ok HTTP response", async () => {
    mockFetchOnce(new Response(null, { status: 404 }))
    await expect(fetchExternalImageSafely("https://example.com/missing.png")).rejects.toThrow(
      UntrustedImageUrlError
    )
  })

  it("rejects a body exceeding the size cap, without trusting Content-Length", async () => {
    const oversized = Buffer.concat([PNG_SIGNATURE, Buffer.alloc(MAX_IMAGE_BYTES)])
    mockFetchOnce(responseWithBody(oversized, "image/png"))
    await expect(fetchExternalImageSafely("https://example.com/huge.png")).rejects.toThrow(
      UntrustedImageUrlError
    )
  })

  it("accepts a valid https image with a public address and matching magic bytes", async () => {
    mockFetchOnce(responseWithBody(PNG_SIGNATURE, "image/png"))
    const result = await fetchExternalImageSafely("https://example.com/a.png")
    expect(result.mimeType).toBe("image/png")
    expect(result.buffer.length).toBe(PNG_SIGNATURE.length)
  })
})
