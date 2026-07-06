import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { GET } from "./route"
import { unanalyzedApplications, getLastBatchRun, __resetQueueForTests } from "@/lib/queue/store"

function callCron(secret?: string) {
  return GET(
    new NextRequest("http://localhost/api/cron/analyze-queue", {
      headers: secret ? { authorization: `Bearer ${secret}` } : {},
    }),
  )
}

describe("GET /api/cron/analyze-queue", () => {
  const originalSecret = process.env.CRON_SECRET

  beforeEach(async () => {
    process.env.CRON_SECRET = "test-secret"
    await __resetQueueForTests()
  })

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = originalSecret
  })

  it("rejects requests without a valid bearer token", async () => {
    const res = await callCron("wrong-secret")
    expect(res.status).toBe(401)
    expect(await unanalyzedApplications()).not.toHaveLength(0)
  })

  it("rejects requests when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET
    const res = await callCron("test-secret")
    expect(res.status).toBe(401)
  })

  it("analyzes all pending applications and records the run", async () => {
    const pendingBefore = await unanalyzedApplications()
    expect(pendingBefore.length).toBeGreaterThan(0)

    const res = await callCron("test-secret")
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.analyzedIds.sort()).toEqual(pendingBefore.map((a) => a.id).sort())
    expect(await unanalyzedApplications()).toHaveLength(0)

    const lastRun = await getLastBatchRun()
    expect(lastRun?.triggeredBy).toBe("cron")
    expect(lastRun?.analyzedCount).toBe(pendingBefore.length)
  })
})
