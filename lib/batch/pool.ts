export type PoolResult<R> = { ok: true; value: R } | { ok: false; error: unknown }

/** Runs `fn` over `items` with at most `limit` concurrent calls. One item
 * throwing never aborts the rest — each result is tagged ok/error so the
 * caller can handle per-item failures individually. */
export async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<PoolResult<R>[]> {
  const results: PoolResult<R>[] = new Array(items.length)
  let cursor = 0

  async function worker(): Promise<void> {
    while (true) {
      const index = cursor++
      if (index >= items.length) return
      try {
        results[index] = { ok: true, value: await fn(items[index], index) }
      } catch (error) {
        results[index] = { ok: false, error }
      }
    }
  }

  const workerCount = Math.min(limit, items.length)
  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return results
}
