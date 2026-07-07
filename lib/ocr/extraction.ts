// Shared Layer 2 field-matching for all text-based OCR providers (Tesseract, Google Vision).
//
// Philosophy: OCR is a *matching* layer, not a blind extraction layer.
// A hint from the application's submitted data is required for a field to return
// a value — without one the field is null. Tolerance is applied only for known
// interchangeable formats (ABV notation variants, volume unit casing), plus a
// fuzzy fallback for OCR noise (typos, garbled small print) when those fail.

import { BoundingBox, BoundingBoxMap, ExtractedLabelData, GuidedSearchHints } from "./types"
import { diceSimilarity } from "../text-similarity"

export type WordLike = {
  text: string
  bbox: { x0: number; y0: number; x1: number; y1: number }
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim()
}

// Returns the hint verbatim if found in OCR text (case-insensitive, whitespace-normalized).
function matchExact(text: string, hint: string | null | undefined): string | null {
  if (!hint) return null
  return normalize(text).includes(normalize(hint)) ? hint : null
}

// ABV: exact match first, then numeric format-variant fallback.
// "45% ABV" matches "45% ALC/VOL.", "45% Alc./Vol.", etc.
function matchAbv(text: string, hint: string | null | undefined): string | null {
  if (!hint) return null
  if (matchExact(text, hint)) return hint
  const num = hint.match(/(\d+(?:\.\d+)?)/)?.[1]
  if (!num) return null
  const m = text.match(
    new RegExp(`${num}\\s*%\\s*(?:Alc(?:ohol)?\\.?\\s*(?:\\/|by)?\\s*Vol(?:ume)?\\.?|ABV)`, "i"),
  )
  return m ? m[0].trim() : null
}

// Net contents: exact match first, then numeric+unit variant fallback.
// "750 mL" matches "750ml", "750 ML", "750 Ml", etc.
function matchNetContents(text: string, hint: string | null | undefined): string | null {
  if (!hint) return null
  if (matchExact(text, hint)) return hint
  const num = hint.match(/(\d+(?:\.\d+)?)/)?.[1]
  if (!num) return null
  const m = text.match(new RegExp(`${num}\\s*(?:mL|ml|ML|L\\b|fl\\.?\\s*oz|oz)`, "i"))
  return m ? m[0].trim() : null
}

// Government warning: normalize both sides to absorb OCR line-break fragmentation.
function matchGovernmentWarning(text: string, hint: string | null | undefined): string | null {
  if (!hint) return null
  return normalize(text).includes(normalize(hint)) ? hint : null
}

function stripPunctuation(s: string): string {
  return s.replace(/[.,'\-]/g, "")
}

function significantWords(s: string): string[] {
  return normalize(s)
    .split(" ")
    .filter((w) => w.length >= 3)
}

// Fuzzy fallback used when a field's strict matcher above returns null — OCR noise
// (typos, garbled small print) can break exact/format-variant matching even though
// the text is genuinely on the label. Mirrors excisely's findInOcrText, reduced to
// the generic stages (no landmark-phrase special-casing):
//   1. punctuation-normalized substring (OCR drops/swaps periods, commas, hyphens)
//   2. word-level sliding window scored by Dice-coefficient bigram similarity
//   3. scattered-word matching — every significant word of the hint appears
//      somewhere in the text, even if not contiguous
// Returns the hint verbatim (not the garbled OCR text) once confidence is high
// enough that any remaining difference is just OCR noise.
export function findFuzzyMatch(text: string, hint: string | null | undefined): string | null {
  if (!hint) return null
  const normText = normalize(text)
  const normHint = normalize(hint)
  if (!normText || !normHint) return null

  if (stripPunctuation(normText).includes(stripPunctuation(normHint))) return hint

  const textWords = normText.split(" ")
  const hintWordCount = normHint.split(" ").length
  const minWords = Math.max(1, hintWordCount - 2)
  const maxWords = Math.min(textWords.length, hintWordCount + 3)

  let bestScore = 0
  for (let size = minWords; size <= maxWords; size++) {
    for (let i = 0; i <= textWords.length - size; i++) {
      const candidate = textWords.slice(i, i + size).join(" ")
      const score = diceSimilarity(candidate, normHint)
      if (score > bestScore) bestScore = score
    }
  }
  if (bestScore >= 0.75) return hint

  const hintWords = significantWords(hint)
  if (hintWords.length >= 2) {
    const allFound = hintWords.every((hw) =>
      textWords.some((tw) => tw === hw || diceSimilarity(tw, hw) >= 0.75),
    )
    if (allFound) return hint
  }

  return null
}

// Main entry point called by every text-based OCR provider.
// All fields require a hint; unset or null hints produce null output.
export function extractFields(text: string, hints?: GuidedSearchHints): ExtractedLabelData {
  return {
    brandName: matchExact(text, hints?.brandName) ?? findFuzzyMatch(text, hints?.brandName),
    classType: matchExact(text, hints?.classType) ?? findFuzzyMatch(text, hints?.classType),
    abv: matchAbv(text, hints?.abv) ?? findFuzzyMatch(text, hints?.abv),
    netContents:
      matchNetContents(text, hints?.netContents) ?? findFuzzyMatch(text, hints?.netContents),
    bottler: matchExact(text, hints?.bottler) ?? findFuzzyMatch(text, hints?.bottler),
    countryOfOrigin:
      matchExact(text, hints?.countryOfOrigin) ?? findFuzzyMatch(text, hints?.countryOfOrigin),
    governmentWarning:
      matchGovernmentWarning(text, hints?.governmentWarning) ??
      findFuzzyMatch(text, hints?.governmentWarning),
  }
}

// Punctuation-tolerant normalizer used only for word-accumulation bbox matching:
// strips periods (except decimal points) and replaces other punctuation incl. "/"
// with a space, so "Alc./Vol." (one OCR word) and "Alc." + "Vol." (two OCR words
// joined with a space during accumulation) normalize to the same string.
function normalizeForBbox(s: string): string {
  return s
    .toLowerCase()
    .replace(/(?<!\d)\.|\.(?!\d)/g, "")
    .replace(/[,;:!?'"()\-/]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

// Whitespace-insensitive variant of the above, used only for the contiguous-run
// containment checks in findContiguousRun: some OCR providers tokenize a number
// and its adjacent "%"/unit as separate words (e.g. "40" + "%"), which the
// accumulation step joins with a forced space ("40 %"). The field's extracted
// text has no such space ("40%"), so those containment checks must ignore
// whitespace differences entirely to still recognize the match.
function stripSpaces(s: string): string {
  return s.replace(/\s+/g, "")
}

// Walks OCR words consecutively, accumulating a candidate string, and scores how
// much of fieldValue it covers — a "skip some and continue" fuzzy match rather
// than requiring every word to independently contain a token. Ported from
// excisely's findMatchingWords. Mirrors findFuzzyMatch's stage 1 (punctuation-
// normalized substring): returns the best matching run of words and a 0-1
// coverage score, or null if nothing clears the acceptance floor.
function findContiguousRun(
  fieldValue: string,
  words: WordLike[],
): { words: WordLike[]; score: number } | null {
  const target = stripSpaces(normalizeForBbox(fieldValue))
  if (!target) return null

  let bestMatch: WordLike[] = []
  let bestScore = 0

  for (let i = 0; i < words.length; i++) {
    if (normalizeForBbox(words[i].text).length < 2) continue

    let accumulated = ""
    const candidates: WordLike[] = []

    for (let j = i; j < words.length && j < i + 60; j++) {
      accumulated += candidates.length > 0 ? " " + words[j].text : words[j].text
      candidates.push(words[j])

      const accNorm = stripSpaces(normalizeForBbox(accumulated))

      if (accNorm === target) return { words: [...candidates], score: 1 }

      if (target.includes(accNorm)) {
        const score = accNorm.length / target.length
        if (score > bestScore) {
          bestScore = score
          bestMatch = [...candidates]
        }
      } else if (accNorm.includes(target)) {
        bestScore = 1
        bestMatch = [...candidates]
        break
      }

      if (accNorm.length > target.length * 1.5 + 20) break
    }
  }

  return bestScore >= 0.6 ? { words: bestMatch, score: bestScore } : null
}

// Mirrors findFuzzyMatch's stage 2: a word-level sliding window scored by
// Dice-coefficient similarity, which tolerates per-character OCR noise (dropped
// leading letters, swapped digits) that stage 1's exact substring walk can't.
function findBestWindowByDice(
  fieldValue: string,
  words: WordLike[],
): { words: WordLike[]; score: number } | null {
  const target = normalizeForBbox(fieldValue)
  if (!target || words.length === 0) return null

  const targetWordCount = target.split(" ").length
  const minSize = Math.max(1, targetWordCount - 2)
  const maxSize = Math.min(words.length, targetWordCount + 3)

  let bestMatch: WordLike[] = []
  let bestScore = 0

  for (let size = minSize; size <= maxSize; size++) {
    for (let i = 0; i <= words.length - size; i++) {
      const candidateWords = words.slice(i, i + size)
      const candidate = normalizeForBbox(candidateWords.map((w) => w.text).join(" "))
      const score = diceSimilarity(candidate, target)
      if (score > bestScore) {
        bestScore = score
        bestMatch = candidateWords
      }
    }
  }

  return bestScore > 0 ? { words: bestMatch, score: bestScore } : null
}

// Mirrors findFuzzyMatch's stage 3: locates each significant word of the field
// value independently, wherever it lands. Used as a last resort so a field that
// only clears fuzzy text-matching (e.g. per-line OCR noise scattered across the
// whole passage) still surfaces *something* visual — disconnected boxes around
// whatever words were actually found — rather than nothing at all.
function findScatteredWords(
  fieldValue: string,
  words: WordLike[],
): { words: WordLike[]; score: number }[] {
  const hintWords = significantWords(fieldValue)
  const matches: { words: WordLike[]; score: number }[] = []

  for (const hw of hintWords) {
    let best: WordLike | null = null
    let bestScore = 0
    for (const w of words) {
      const wNorm = normalizeForBbox(w.text)
      if (!wNorm) continue
      const score = wNorm === hw ? 1 : diceSimilarity(wNorm, hw)
      if (score > bestScore) {
        bestScore = score
        best = w
      }
    }
    if (best && bestScore >= 0.75) {
      matches.push({ words: [best], score: bestScore })
    }
  }

  return matches
}

function boxFromWords(
  matched: WordLike[],
  score: number,
  W: number,
  H: number,
  imageIndex: number,
): BoundingBox {
  const x0 = Math.min(...matched.map((w) => w.bbox.x0))
  const y0 = Math.min(...matched.map((w) => w.bbox.y0))
  const x1 = Math.max(...matched.map((w) => w.bbox.x1))
  const y1 = Math.max(...matched.map((w) => w.bbox.y1))
  return {
    imageIndex,
    x: x0 / W,
    y: y0 / H,
    width: (x1 - x0) / W,
    height: (y1 - y0) / H,
    confidence: score,
  }
}

// Locates a field's value among OCR words, using the same three-stage fallback
// as the text-matching layer (findFuzzyMatch) so a field that passes text
// matching always has *something* to show visually. A garbled or scattered OCR
// read produces multiple disconnected boxes rather than silently returning
// nothing — a partial, imprecise answer beats "no location found on label".
export function computeFieldBoxes(
  words: WordLike[],
  fieldValue: string | null,
  W: number,
  H: number,
  imageIndex = 0,
): BoundingBox[] {
  if (!fieldValue || words.length === 0 || W === 0 || H === 0) return []

  const contiguous = findContiguousRun(fieldValue, words)
  if (contiguous) return [boxFromWords(contiguous.words, contiguous.score, W, H, imageIndex)]

  const window = findBestWindowByDice(fieldValue, words)
  if (window && window.score >= 0.75) {
    return [boxFromWords(window.words, window.score, W, H, imageIndex)]
  }

  const scattered = findScatteredWords(fieldValue, words)
  return scattered.map((m) => boxFromWords(m.words, m.score, W, H, imageIndex))
}
