import { describe, it, expect, beforeEach } from "vitest"
import {
  listQueue,
  getApplication,
  unanalyzedApplications,
  resolveApplication,
  addMockApplication,
  __resetQueueForTests,
} from "./store"

describe("queue store", () => {
  beforeEach(() => {
    __resetQueueForTests()
  })

  it("lists seeded applications excluding resolved ones", () => {
    const items = listQueue()
    expect(items.length).toBeGreaterThan(0)
    expect(items.every((i) => i.status !== "resolved")).toBe(true)
  })

  it("sorts by flag count descending", () => {
    const items = listQueue()
    for (let i = 1; i < items.length; i++) {
      expect(items[i - 1].flagCount).toBeGreaterThanOrEqual(items[i].flagCount)
    }
  })

  it("getApplication returns undefined for unknown id", () => {
    expect(getApplication("nope")).toBeUndefined()
  })

  it("unanalyzedApplications returns only pending applications", () => {
    const pending = unanalyzedApplications()
    expect(pending.every((a) => a.status === "pending")).toBe(true)
    expect(pending.length).toBeGreaterThan(0)
  })

  it("addMockApplication adds a pending application to the queue", () => {
    const before = listQueue().length
    const added = addMockApplication()
    expect(added.status).toBe("pending")
    expect(listQueue().length).toBe(before + 1)
  })

  it("resolveApplication marks status resolved and removes it from listQueue", () => {
    const target = listQueue().find((i) => i.status === "analyzed")!
    resolveApplication(target.id, {
      decision: "approved",
      overrides: [],
      rejectedFields: [],
      note: "",
      resolvedAt: new Date().toISOString(),
    })
    expect(listQueue().find((i) => i.id === target.id)).toBeUndefined()
    expect(getApplication(target.id)?.status).toBe("resolved")
  })
})
