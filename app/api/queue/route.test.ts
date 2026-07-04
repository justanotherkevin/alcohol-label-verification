import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { GET, POST } from "./route"
import { listQueue, __resetQueueForTests } from "@/lib/queue/store"

describe("GET /api/queue", () => {
  beforeEach(async () => {
    await __resetQueueForTests()
  })

  it("returns paginated items, total, and counts", async () => {
    const res = await GET(new Request("http://localhost/api/queue?page=1&pageSize=1"))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items).toHaveLength(1)
    expect(body.page).toBe(1)
    expect(body.pageSize).toBe(1)
    expect(body.total).toBeGreaterThan(0)
    expect(body.counts.pending + body.counts.flagged + body.counts.clean).toBe(body.total)
  })

  it("defaults to page 1 with the default page size when no query params are given", async () => {
    const res = await GET(new Request("http://localhost/api/queue"))
    const body = await res.json()
    expect(body.page).toBe(1)
    expect(body.pageSize).toBe(25)
  })

  it("clamps pageSize to the maximum of 100", async () => {
    const res = await GET(new Request("http://localhost/api/queue?pageSize=500"))
    const body = await res.json()
    expect(body.pageSize).toBe(100)
  })
})

describe("POST /api/queue", () => {
  beforeEach(async () => {
    await __resetQueueForTests()
  })

  afterEach(() => {
    delete process.env.VERCEL_ENV
  })

  it("adds a pending mock application to the queue", async () => {
    const before = await listQueue(1, 1000)

    const res = await POST()
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBeTruthy()

    const after = await listQueue(1, 1000)
    expect(after.total).toBe(before.total + 1)
  })

  it("returns 403 and does not add an application when running in production", async () => {
    process.env.VERCEL_ENV = "production"
    const before = await listQueue(1, 1000)

    const res = await POST()
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/disabled in production/i)

    const after = await listQueue(1, 1000)
    expect(after.total).toBe(before.total)
  })
})
