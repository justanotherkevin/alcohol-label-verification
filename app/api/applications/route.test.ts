import { describe, it, expect, beforeEach } from "vitest"
import { POST } from "./route"
import { getApplication, __resetQueueForTests } from "@/lib/queue/store"
import { LABEL_CATALOG } from "@/lib/queue/label-catalog"

function postApplication(body: Record<string, unknown>) {
  return POST(
    new Request("http://localhost/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  )
}

describe("POST /api/applications", () => {
  beforeEach(async () => {
    await __resetQueueForTests()
  })

  it("uses the catalog's demo images when no imageOverrides are given", async () => {
    const entry = LABEL_CATALOG.find((e) => e.imageKeys.length === 1)!
    const res = await postApplication({ applicant: "Jane Doe", catalogKey: entry.key })
    expect(res.status).toBe(201)
    const { id } = await res.json()

    const app = await getApplication(id)
    expect(app!.images[0].path).toBe(`/demo-labels/${entry.imageKeys[0].split("/").pop()}`)
  })

  it("replaces only the overridden slot's path/mimeType, keeping other slots at their catalog default", async () => {
    const entry = LABEL_CATALOG.find((e) => e.imageKeys.length > 1)!
    const res = await postApplication({
      applicant: "Jane Doe",
      catalogKey: entry.key,
      imageOverrides: {
        0: { path: "https://example.public.blob.vercel-storage.com/my-label.jpg", mimeType: "image/jpeg" },
      },
    })
    expect(res.status).toBe(201)
    const { id } = await res.json()

    const app = await getApplication(id)
    expect(app!.images[0].path).toBe("https://example.public.blob.vercel-storage.com/my-label.jpg")
    expect(app!.images[0].mimeType).toBe("image/jpeg")
    expect(app!.images[1].path).toBe(`/demo-labels/${entry.imageKeys[1].split("/").pop()}`)
  })

  it("accepts a local-dev fallback upload path (/uploads/...)", async () => {
    const entry = LABEL_CATALOG.find((e) => e.imageKeys.length === 1)!
    const res = await postApplication({
      applicant: "Jane Doe",
      catalogKey: entry.key,
      imageOverrides: { 0: { path: "/uploads/abc123.jpg", mimeType: "image/jpeg" } },
    })
    expect(res.status).toBe(201)
    const { id } = await res.json()
    const app = await getApplication(id)
    expect(app!.images[0].path).toBe("/uploads/abc123.jpg")
  })

  it("rejects an imageOverrides path that isn't our own upload storage (SSRF guard)", async () => {
    const entry = LABEL_CATALOG.find((e) => e.imageKeys.length === 1)!
    const res = await postApplication({
      applicant: "Jane Doe",
      catalogKey: entry.key,
      imageOverrides: {
        0: { path: "http://169.254.169.254/latest/meta-data/", mimeType: "image/jpeg" },
      },
    })
    expect(res.status).toBe(400)
  })

  it("rejects an imageOverrides mimeType outside the allowed image types", async () => {
    const entry = LABEL_CATALOG.find((e) => e.imageKeys.length === 1)!
    const res = await postApplication({
      applicant: "Jane Doe",
      catalogKey: entry.key,
      imageOverrides: {
        0: { path: "https://example.public.blob.vercel-storage.com/x.svg", mimeType: "image/svg+xml" },
      },
    })
    expect(res.status).toBe(400)
  })
})
