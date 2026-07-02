import { describe, it, expect, beforeEach } from "vitest"
import { GET } from "./route"
import { listQueue, resolveApplication, __resetQueueForTests } from "@/lib/queue/store"

describe("GET /api/audit", () => {
  beforeEach(async () => {
    await __resetQueueForTests()
  })

  it("returns empty entries/activity and zeroed summary when nothing is resolved", async () => {
    const res = await GET(new Request("http://localhost/api/audit"))
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
    const [approved, rejected] = (await listQueue(1, 1000)).items
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

    const res = await GET(new Request("http://localhost/api/audit"))
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

  it("paginates entries and reports total independent of page size", async () => {
    const [approved, rejected] = (await listQueue(1, 1000)).items
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

    const page1 = await (await GET(new Request("http://localhost/api/audit?page=1&pageSize=1"))).json()
    const page2 = await (await GET(new Request("http://localhost/api/audit?page=2&pageSize=1"))).json()

    expect(page1.entries).toHaveLength(1)
    expect(page2.entries).toHaveLength(1)
    expect(page1.total).toBe(2)
    expect(page2.total).toBe(2)
    expect(page1.entries[0].id).not.toBe(page2.entries[0].id)
  })

  it("caps an oversized pageSize instead of returning every row", async () => {
    const res = await GET(new Request("http://localhost/api/audit?pageSize=999999999"))
    const body = await res.json()
    expect(body.pageSize).toBeLessThanOrEqual(100)
  })
})
