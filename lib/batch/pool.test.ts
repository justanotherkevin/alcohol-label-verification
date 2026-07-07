import { describe, it, expect } from "vitest"
import { runWithConcurrency } from "./pool"

describe("runWithConcurrency", () => {
  it("never runs more than `limit` items at once", async () => {
    let active = 0
    let maxActive = 0
    const items = Array.from({ length: 20 }, (_, i) => i)

    await runWithConcurrency(items, 4, async (item) => {
      active++
      maxActive = Math.max(maxActive, active)
      await new Promise((r) => setTimeout(r, 5))
      active--
      return item * 2
    })

    expect(maxActive).toBeLessThanOrEqual(4)
  })

  it("returns results in the same order as the input", async () => {
    const items = [1, 2, 3, 4, 5]
    const results = await runWithConcurrency(items, 2, async (item) => item * 10)
    expect(results.map((r) => (r.ok ? r.value : undefined))).toEqual([10, 20, 30, 40, 50])
  })

  it("isolates a failing item without aborting the rest", async () => {
    const items = [1, 2, 3]
    const results = await runWithConcurrency(items, 3, async (item) => {
      if (item === 2) throw new Error("boom")
      return item
    })
    expect(results[0]).toEqual({ ok: true, value: 1 })
    expect(results[1].ok).toBe(false)
    expect(results[2]).toEqual({ ok: true, value: 3 })
  })

  it("handles an empty item list", async () => {
    const results = await runWithConcurrency([], 4, async (item) => item)
    expect(results).toEqual([])
  })
})
