import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { DELETE } from "./route"
import { listQueue, addMockApplication, __resetQueueForTests } from "@/lib/queue/store"

describe("DELETE /api/queue/reset", () => {
  beforeEach(async () => {
    await __resetQueueForTests()
  })

  afterEach(() => {
    delete process.env.VERCEL_ENV
  })

  it("deletes existing applications and restores the seed set", async () => {
    await addMockApplication()
    const before = await listQueue(1, 1000)
    const seedTotal = before.total - 1

    const res = await DELETE()
    expect(res.status).toBe(200)

    const after = await listQueue(1, 1000)
    expect(after.total).toBe(seedTotal)
  })

  it("returns 403 and leaves the queue untouched when running in production", async () => {
    process.env.VERCEL_ENV = "production"
    await addMockApplication()
    const before = await listQueue(1, 1000)

    const res = await DELETE()
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/disabled in production/i)

    const after = await listQueue(1, 1000)
    expect(after.total).toBe(before.total)
  })
})
