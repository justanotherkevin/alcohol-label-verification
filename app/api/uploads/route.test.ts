import { describe, it, expect, afterEach } from "vitest"
import fs from "fs/promises"
import path from "path"
import { POST } from "./route"

const uploadsDir = path.join(process.cwd(), "public", "uploads")

function requestWithFile(file: File | null) {
  const form = new FormData()
  if (file) form.append("file", file)
  return new Request("http://localhost/api/uploads", { method: "POST", body: form })
}

describe("POST /api/uploads", () => {
  afterEach(async () => {
    await fs.rm(uploadsDir, { recursive: true, force: true })
    delete process.env.BLOB_READ_WRITE_TOKEN
    delete process.env.VERCEL
  })

  it("rejects a request with no file", async () => {
    const res = await POST(requestWithFile(null))
    expect(res.status).toBe(400)
  })

  it("rejects an unsupported file type", async () => {
    const file = new File(["not an image"], "notes.txt", { type: "text/plain" })
    const res = await POST(requestWithFile(file))
    expect(res.status).toBe(400)
  })

  it("rejects a file over the 8MB limit", async () => {
    const oversized = new File([new Uint8Array(8 * 1024 * 1024 + 1)], "big.jpg", { type: "image/jpeg" })
    const res = await POST(requestWithFile(oversized))
    expect(res.status).toBe(400)
  })

  it("falls back to writing under public/uploads when no Blob token is configured", async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN
    const bytes = new Uint8Array([1, 2, 3, 4])
    const file = new File([bytes], "my-label.jpg", { type: "image/jpeg" })

    const res = await POST(requestWithFile(file))
    expect(res.status).toBe(201)

    const body = (await res.json()) as { url: string; mimeType: string }
    expect(body.mimeType).toBe("image/jpeg")
    expect(body.url).toMatch(/^\/uploads\/[0-9a-f-]+\.jpg$/)

    const written = await fs.readFile(path.join(process.cwd(), "public", body.url.replace(/^\//, "")))
    expect(Buffer.from(written)).toEqual(Buffer.from(bytes))
  })

  it("ignores a path-traversal attempt in the client-supplied filename", async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN
    const file = new File([new Uint8Array([1])], "../../../../tmp/evil.jpg", { type: "image/jpeg" })

    const res = await POST(requestWithFile(file))
    expect(res.status).toBe(201)

    const body = (await res.json()) as { url: string }
    // the returned path must stay inside /uploads/ — no directory traversal
    expect(body.url).toMatch(/^\/uploads\/[0-9a-f-]+\.jpg$/)
    const escaped = await fs
      .access(path.join(process.cwd(), "tmp", "evil.jpg"))
      .then(() => true)
      .catch(() => false)
    expect(escaped).toBe(false)
  })

  it("returns a clear 500 instead of crashing when deployed to Vercel without a Blob store connected", async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN
    process.env.VERCEL = "1"
    const file = new File([new Uint8Array([1])], "my-label.jpg", { type: "image/jpeg" })

    const res = await POST(requestWithFile(file))
    expect(res.status).toBe(500)
    const body = (await res.json()) as { error: string }
    expect(body.error).toMatch(/blob store/i)

    // must not have attempted the local-disk fallback (Vercel's deployed fs is read-only)
    const wroteLocally = await fs
      .access(uploadsDir)
      .then(() => true)
      .catch(() => false)
    expect(wroteLocally).toBe(false)
  })

  it("gives each upload a unique filename so replacements don't collide", async () => {
    const makeFile = () => new File([new Uint8Array([9])], "same-name.png", { type: "image/png" })

    const res1 = await POST(requestWithFile(makeFile()))
    const res2 = await POST(requestWithFile(makeFile()))
    const { url: url1 } = (await res1.json()) as { url: string }
    const { url: url2 } = (await res2.json()) as { url: string }

    expect(url1).not.toBe(url2)
  })
})
