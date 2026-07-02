import { describe, it, expect, beforeEach } from "vitest"
import { GET } from "./route"
import { listQueue, resolveApplication, __resetQueueForTests } from "@/lib/queue/store"

describe("GET /api/audit", () => {
  beforeEach(async () => {
    await __resetQueueForTests()
  })

  it("returns empty entries/activity and zeroed summary when nothing is resolved", async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.entries).toEqual([])
    expect(body.summary).toEqual({
      totalReviews: 0,
      complianceRate: 0,
      rejectedCount: 0,
      avgResponseHours: 0,
    })
  })

  it("reflects resolved applications in entries, summary, and activity", async () => {
    const [approved, rejected] = (await listQueue())
      .filter((i) => i.status === "analyzed")
      .slice(0, 2)

    await resolveApplication(approved.id, {
      decision: "approved",
      overrides: [],
      rejectedFields: [],
      note: "",
      resolvedAt: new Date().toISOString(),
      specialistId: "dave-morrison",
    })
    await resolveApplication(rejected.id, {
      decision: "rejected",
      overrides: [],
      rejectedFields: ["abv"],
      note: "ABV mismatch",
      resolvedAt: new Date().toISOString(),
      specialistId: "jenny-park",
    })

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()

    const entryIds = body.entries.map((e: { id: string }) => e.id)
    expect(entryIds).toEqual(expect.arrayContaining([approved.id, rejected.id]))

    expect(body.summary.totalReviews).toBe(2)
    expect(body.summary.complianceRate).toBe(50)
    expect(body.summary.rejectedCount).toBe(1)

    const activityTexts = body.activity.map((a: { text: string }) => a.text)
    expect(activityTexts).toEqual(
      expect.arrayContaining([`${approved.id} approved`, `${rejected.id} rejected`])
    )
  })
})
