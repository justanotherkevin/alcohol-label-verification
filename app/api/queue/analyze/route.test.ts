import { describe, it, expect, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import { POST } from "./route"
import {
  listQueue,
  unanalyzedApplications,
  resolveApplication,
  __resetQueueForTests,
} from "@/lib/queue/store"

function callAnalyze(body?: { ids?: string[]; force?: boolean }) {
  return POST(
    new NextRequest("http://localhost/api/queue/analyze", {
      method: "POST",
      headers: { "X-Ocr-Provider": "mock" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
  )
}

describe("POST /api/queue/analyze", () => {
  beforeEach(async () => {
    await __resetQueueForTests()
  })

  it("analyzes all pending applications when no ids are given", async () => {
    const pendingBefore = await unanalyzedApplications()
    expect(pendingBefore.length).toBeGreaterThan(0)

    const res = await callAnalyze()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.analyzedIds.sort()).toEqual(pendingBefore.map((a) => a.id).sort())

    expect(await unanalyzedApplications()).toHaveLength(0)
  })

  it("analyzes only the requested ids when a body is provided", async () => {
    const pendingBefore = await unanalyzedApplications()
    const target = pendingBefore[0]

    const res = await callAnalyze({ ids: [target.id] })
    const body = await res.json()
    expect(body.analyzedIds).toEqual([target.id])

    const stillPending = await unanalyzedApplications()
    expect(stillPending.find((a) => a.id === target.id)).toBeUndefined()
    expect(stillPending.length).toBe(pendingBefore.length - 1)
  })

  it("ignores requested ids that are unknown or already analyzed", async () => {
    const analyzed = (await listQueue(1, 1000)).items.find((i) => i.status === "analyzed")!

    const res = await callAnalyze({ ids: ["does-not-exist", analyzed.id] })
    const body = await res.json()
    expect(body.analyzedIds).toEqual([])
  })

  it("re-runs OCR on an already-analyzed application when force is set", async () => {
    const analyzed = (await listQueue(1, 1000)).items.find((i) => i.status === "analyzed")!

    const res = await callAnalyze({ ids: [analyzed.id], force: true })
    const body = await res.json()
    expect(body.analyzedIds).toEqual([analyzed.id])
  })

  it("does not re-run OCR on a resolved application even when force is set", async () => {
    const analyzed = (await listQueue(1, 1000)).items.find((i) => i.status === "analyzed")!
    await resolveApplication(analyzed.id, {
      decision: "approved",
      overrides: [],
      rejectedFields: [],
      note: "",
      resolvedAt: new Date().toISOString(),
    })

    const res = await callAnalyze({ ids: [analyzed.id], force: true })
    const body = await res.json()
    expect(body.analyzedIds).toEqual([])
  })

  it("still works in production (pre-analysis is not a dev-only tool)", async () => {
    process.env.VERCEL_ENV = "production"
    try {
      const res = await callAnalyze()
      expect(res.status).toBe(200)
    } finally {
      delete process.env.VERCEL_ENV
    }
  })
})
