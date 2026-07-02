import { describe, it, expect, beforeEach } from "vitest"
import {
  listQueue,
  getApplication,
  unanalyzedApplications,
  resolveApplication,
  revertResolution,
  addMockApplication,
  __resetQueueForTests,
} from "./store"

describe("queue store", () => {
  beforeEach(async () => {
    await __resetQueueForTests()
  })

  it("lists seeded applications excluding resolved ones", async () => {
    const items = await listQueue()
    expect(items.length).toBeGreaterThan(0)
    expect(items.every((i) => i.status !== "resolved")).toBe(true)
  })

  it("sorts by flag count descending", async () => {
    const items = await listQueue()
    for (let i = 1; i < items.length; i++) {
      expect(items[i - 1].flagCount).toBeGreaterThanOrEqual(items[i].flagCount)
    }
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
    const before = (await listQueue()).length
    const added = await addMockApplication()
    expect(added.status).toBe("pending")
    expect((await listQueue()).length).toBe(before + 1)
  })

  it("resolveApplication marks status resolved and removes it from listQueue", async () => {
    const target = (await listQueue()).find((i) => i.status === "analyzed")!
    await resolveApplication(target.id, {
      decision: "approved",
      overrides: [],
      rejectedFields: [],
      note: "",
      resolvedAt: new Date().toISOString(),
    })
    expect((await listQueue()).find((i) => i.id === target.id)).toBeUndefined()
    expect((await getApplication(target.id))?.status).toBe("resolved")
  })

  it("revertResolution returns application to analyzed and restores it to listQueue", async () => {
    const target = (await listQueue()).find((i) => i.status === "analyzed")!
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
    expect((await listQueue()).find((i) => i.id === target.id)).toBeDefined()
  })
})
