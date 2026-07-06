function bigrams(s: string): Set<string> {
  const out = new Set<string>()
  for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2))
  return out
}

// Dice-coefficient bigram similarity, 0-1.
export function diceSimilarity(a: string, b: string): number {
  const na = a.toLowerCase().trim()
  const nb = b.toLowerCase().trim()
  if (!na || !nb) return 0
  if (na === nb) return 1
  const ba = bigrams(na)
  const bb = bigrams(nb)
  if (ba.size === 0 || bb.size === 0) return 0
  let overlap = 0
  for (const bg of ba) if (bb.has(bg)) overlap++
  return (2 * overlap) / (ba.size + bb.size)
}
