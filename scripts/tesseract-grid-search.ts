/**
 * Grid-searches Tesseract preprocessing/PSM configs against the manually
 * validated ground truth in tests/mocks/labels/_ground_truth.json.
 *
 * Scoring is partial-credit, not binary: each ground-truth field value is
 * split into tokens, and the score is the fraction of tokens that show up
 * among the OCR'd words for that image/config. The same token-match set is
 * used to compute the field's bounding box (via computeFieldBbox), so a
 * config that only reads part of a string still gets a partial score AND a
 * bounding box covering just the part it actually found — mirroring how a
 * partial match should behave in production, not an all-or-nothing gate.
 *
 * Run with: npx tsx scripts/tesseract-grid-search.ts [--images=N] [--top=N]
 */

import fs from "fs"
import path from "path"
import sharp from "sharp"
import { createWorker, OEM, PSM } from "tesseract.js"
import { computeFieldBbox, WordLike } from "../lib/ocr/extraction"
import { ExtractedLabelData } from "../lib/ocr/types"

const LABELS_DIR = path.join(process.cwd(), "tests", "mocks", "labels")
const IMAGES_DIR = path.join(process.cwd(), "public", "demo-labels")
const GROUND_TRUTH_PATH = path.join(LABELS_DIR, "_ground_truth.json")

type GroundTruthEntry = { verified: boolean } & ExtractedLabelData

type PreprocessConfig = {
  name: string
  grayscale: boolean
  scale: number
  denoise: boolean
  binarize: boolean
  invert: boolean
}

type Config = {
  name: string
  psm: PSM
  preprocessing: PreprocessConfig
}

const PREPROCESS_VARIANTS: PreprocessConfig[] = [
  { name: "none", grayscale: false, scale: 1, denoise: false, binarize: false, invert: false },
  { name: "grayscale", grayscale: true, scale: 1, denoise: false, binarize: false, invert: false },
  { name: "grayscale+denoise", grayscale: true, scale: 1, denoise: true, binarize: false, invert: false },
  { name: "grayscale+invert", grayscale: true, scale: 1, denoise: false, binarize: false, invert: true },
  { name: "grayscale+denoise+invert", grayscale: true, scale: 1, denoise: true, binarize: false, invert: true },
  { name: "grayscale+binarize", grayscale: true, scale: 1, denoise: false, binarize: true, invert: false },
  { name: "grayscale+scale2", grayscale: true, scale: 2, denoise: false, binarize: false, invert: false },
  { name: "grayscale+scale2+denoise+invert", grayscale: true, scale: 2, denoise: true, binarize: false, invert: true },
]

const PSM_VARIANTS: { name: string; value: PSM }[] = [
  { name: "AUTO(3)", value: PSM.AUTO },
  { name: "SINGLE_COLUMN(4)", value: PSM.SINGLE_COLUMN },
  { name: "SINGLE_BLOCK(6)", value: PSM.SINGLE_BLOCK },
  { name: "SPARSE_TEXT(11)", value: PSM.SPARSE_TEXT },
]

function buildConfigs(): Config[] {
  const configs: Config[] = []
  for (const pre of PREPROCESS_VARIANTS) {
    for (const psm of PSM_VARIANTS) {
      configs.push({ name: `${pre.name} | psm=${psm.name}`, psm: psm.value, preprocessing: pre })
    }
  }
  return configs
}

async function preprocess(buffer: Buffer, cfg: PreprocessConfig): Promise<{ buffer: Buffer; width: number; height: number }> {
  let image = sharp(buffer)
  if (cfg.grayscale) image = image.grayscale()
  if (cfg.scale !== 1) {
    const meta = await sharp(buffer).metadata()
    const width = Math.round((meta.width ?? 0) * cfg.scale)
    if (width > 0) image = image.resize({ width })
  }
  if (cfg.denoise) image = image.median(3)
  if (cfg.binarize) image = image.threshold()
  if (cfg.invert) image = image.negate()
  const processed = await image.toBuffer({ resolveWithObject: true })
  return { buffer: processed.data, width: processed.info.width, height: processed.info.height }
}

function resolveImagePath(key: string): string | null {
  for (const ext of [".png", ".jpg", ".jpeg"]) {
    const p = path.join(IMAGES_DIR, `${key}${ext}`)
    if (fs.existsSync(p)) return p
  }
  return null
}

// Fraction of fieldValue's tokens found among the OCR'd words (same containment
// rule computeFieldBbox uses), plus the tokens themselves for inspection.
function tokenMatchRatio(words: WordLike[], fieldValue: string): { ratio: number; matched: number; total: number } {
  const tokens = fieldValue.toLowerCase().split(/\s+/).filter((t) => t.length > 1)
  if (tokens.length === 0) return { ratio: 0, matched: 0, total: 0 }
  const wordTexts = words.map((w) => w.text.toLowerCase()).filter((t) => t.length > 1)
  const matchedTokens = tokens.filter((t) => wordTexts.some((w) => w.includes(t) || t.includes(w)))
  return { ratio: matchedTokens.length / tokens.length, matched: matchedTokens.length, total: tokens.length }
}

type FieldKey = keyof ExtractedLabelData
const FIELDS: FieldKey[] = [
  "brandName",
  "classType",
  "abv",
  "netContents",
  "bottler",
  "countryOfOrigin",
  "governmentWarning",
]

async function main() {
  const args = process.argv.slice(2)
  const imagesLimit = Number(args.find((a) => a.startsWith("--images="))?.split("=")[1] ?? Infinity)
  const topN = Number(args.find((a) => a.startsWith("--top="))?.split("=")[1] ?? 3)

  const raw: Record<string, unknown> = JSON.parse(fs.readFileSync(GROUND_TRUTH_PATH, "utf-8"))
  delete raw["_readme"]
  const groundTruth = raw as Record<string, GroundTruthEntry>

  const testCases = Object.entries(groundTruth)
    .filter(([, entry]) => entry.verified)
    .filter(([key]) => resolveImagePath(key) !== null)
    .slice(0, imagesLimit)

  const unverified = Object.entries(groundTruth).filter(([, e]) => !e.verified)
  if (unverified.length > 0) {
    console.log(`Skipping ${unverified.length} unverified entries: ${unverified.map(([k]) => k).join(", ")}\n`)
  }

  console.log(`Testing against ${testCases.length} images: ${testCases.map(([k]) => k).join(", ")}`)

  const imageBuffers = new Map<string, Buffer>()
  for (const [key] of testCases) {
    imageBuffers.set(key, fs.readFileSync(resolveImagePath(key)!))
  }

  const configs = buildConfigs()
  console.log(`Running ${configs.length} configs x ${testCases.length} images = ${configs.length * testCases.length} OCR passes...\n`)

  const worker = await createWorker("eng", OEM.LSTM_ONLY)

  const results: {
    config: Config
    overallRatio: number
    perImage: Record<string, Record<string, string>>
  }[] = []

  try {
    for (const config of configs) {
      await worker.setParameters({ tessedit_pageseg_mode: config.psm })

      const allRatios: number[] = []
      const perImage: Record<string, Record<string, string>> = {}

      for (const [key, entry] of testCases) {
        const rawBuffer = imageBuffers.get(key)!
        const { buffer, width, height } = await preprocess(rawBuffer, config.preprocessing)
        const { data } = await worker.recognize(buffer, {}, { blocks: true })

        const words: WordLike[] = (data.blocks ?? [])
          .flatMap((b) => b.paragraphs)
          .flatMap((p) => p.lines)
          .flatMap((l) => l.words)

        perImage[key] = {}

        for (const field of FIELDS) {
          const truthValue = entry[field]
          if (truthValue === null) continue
          const { ratio, matched, total } = tokenMatchRatio(words, truthValue)
          const bbox = computeFieldBbox(words, truthValue, width, height)
          allRatios.push(ratio)
          perImage[key][field] = `${(ratio * 100).toFixed(0)}% (${matched}/${total} tokens)${bbox ? "" : " [no bbox]"}`
        }
      }

      const overallRatio = allRatios.length > 0 ? allRatios.reduce((a, b) => a + b, 0) / allRatios.length : 0
      results.push({ config, overallRatio, perImage })
      console.log(`[${(overallRatio * 100).toFixed(1)}%] ${config.name}`)
    }
  } finally {
    await worker.terminate()
  }

  results.sort((a, b) => b.overallRatio - a.overallRatio)

  console.log(`\n=== Top ${topN} configs ===`)
  for (const r of results.slice(0, topN)) {
    console.log(`\n${r.config.name}`)
    console.log(`  overall token-match: ${(r.overallRatio * 100).toFixed(1)}%`)
    console.log(`  preprocessing: ${JSON.stringify(r.config.preprocessing)}`)
    console.log(`  per-image: ${JSON.stringify(r.perImage, null, 2)}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
