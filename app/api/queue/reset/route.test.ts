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

  it("still resets demo data when running in production (skips filesystem regeneration)", async () => {
    process.env.VERCEL_ENV = "production"
    await addMockApplication()
    const before = await listQueue(1, 1000)
    const seedTotal = before.total - 1

    const res = await DELETE()
    expect(res.status).toBe(200)

    const after = await listQueue(1, 1000)
    expect(after.total).toBe(seedTotal)
  })
})
