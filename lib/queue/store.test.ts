import { describe, it, expect, beforeEach } from "vitest"
import {
  listQueue,
  getApplication,
  unanalyzedApplications,
  resolveApplication,
  revertResolution,
  addMockApplication,
  recordBatchRun,
  getLastBatchRun,
  __resetQueueForTests,
} from "./store"

describe("queue store", () => {
  beforeEach(async () => {
    await __resetQueueForTests()
  })

  it("lists seeded applications excluding resolved ones", async () => {
    const { items, total } = await listQueue()
    expect(total).toBeGreaterThan(0)
    expect(items.every((i) => i.status !== "resolved")).toBe(true)
  })

  it("sorts by flag count descending", async () => {
    const { items } = await listQueue(1, 1000)
    for (let i = 1; i < items.length; i++) {
      expect(items[i - 1].flagCount).toBeGreaterThanOrEqual(items[i].flagCount)
    }
  })

  it("paginates results and reports accurate counts across pages", async () => {
    const full = await listQueue(1, 1000)
    expect(full.total).toBeGreaterThan(2)

    const pageSize = Math.ceil(full.total / 2)
    const page1 = await listQueue(1, pageSize)
    const page2 = await listQueue(2, pageSize)

    expect(page1.items.length).toBe(pageSize)
    expect(page1.items.length + page2.items.length).toBe(full.total)
    expect(page1.total).toBe(full.total)
    expect(page2.total).toBe(full.total)

    const page1Ids = new Set(page1.items.map((i) => i.id))
    expect(page2.items.every((i) => !page1Ids.has(i.id))).toBe(true)

    expect(page1.counts).toEqual(page2.counts)
    expect(page1.counts.pending + page1.counts.flagged + page1.counts.clean).toBe(full.total)
  })

  it("getApplication returns undefined for unknown id", async () => {
    expect(await getApplication("nope")).toBeUndefined()
  })

  it("unanalyzedApplications returns only pending applications", async () => {
    const pending = await unanalyzedApplications()
    expect(pending.every((a) => a.status === "pending")).toBe(true)
    expect(pending.length).toBeGreaterThan(0)
  })

  it("addMockApplication adds a pending application to the queue", async () => {
    const before = (await listQueue()).total
    const added = await addMockApplication()
    expect(added.status).toBe("pending")
    expect((await listQueue()).total).toBe(before + 1)
  })

  it("resolveApplication marks status resolved and removes it from listQueue", async () => {
    const target = (await listQueue(1, 1000)).items.find((i) => i.status === "analyzed")!
    await resolveApplication(target.id, {
      decision: "approved",
      overrides: [],
      rejectedFields: [],
      note: "",
      resolvedAt: new Date().toISOString(),
    })
    expect((await listQueue(1, 1000)).items.find((i) => i.id === target.id)).toBeUndefined()
    expect((await getApplication(target.id))?.status).toBe("resolved")
  })

  it("revertResolution returns application to analyzed and restores it to listQueue", async () => {
    const target = (await listQueue(1, 1000)).items.find((i) => i.status === "analyzed")!
    await resolveApplication(target.id, {
      decision: "approved",
      overrides: [],
      rejectedFields: [],
      note: "",
      resolvedAt: new Date().toISOString(),
    })
    expect((await getApplication(target.id))?.status).toBe("resolved")

    await revertResolution(target.id)
    const reverted = await getApplication(target.id)
    expect(reverted?.status).toBe("analyzed")
    expect(reverted?.reviewData.resolution).toBeNull()
    expect((await listQueue(1, 1000)).items.find((i) => i.id === target.id)).toBeDefined()
  })

  it("getLastBatchRun returns the most recently recorded run", async () => {
    await recordBatchRun("manual", 3)
    const first = await getLastBatchRun()
    expect(first?.triggeredBy).toBe("manual")
    expect(first?.analyzedCount).toBe(3)

    await recordBatchRun("cron", 5)
    const second = await getLastBatchRun()
    expect(second?.triggeredBy).toBe("cron")
    expect(second?.analyzedCount).toBe(5)
    expect(second!.id).toBeGreaterThan(first!.id)
  })
})
