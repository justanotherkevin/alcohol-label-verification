/**
 * Regenerates tests/mocks/labels/_extracted.json from the *.vision.json fixtures.
 * Run with: npx tsx scripts/regenerate-extracted.ts
 *
 * Uses guided search (extractWithHints) with applicationData from SEED_HINTS
 * so the output matches what the live guided OCR pipeline would produce.
 */

import fs from "fs"
import path from "path"
import { computeFieldBbox, extractFields } from "../lib/ocr/extraction"
import { BoundingBoxMap, ExtractedLabelData } from "../lib/ocr/types"
import { SEED_HINTS } from "../lib/queue/seed-data"

const LABELS_DIR = path.join(process.cwd(), "tests", "mocks", "labels")
const OUT_PATH = path.join(LABELS_DIR, "_extracted.json")

type Vertex = { x?: number; y?: number }
type VisionWord = {
  boundingBox?: { vertices?: Vertex[] }
  symbols?: { text: string }[]
}

function processVisionFile(
  visionPath: string,
  imageIndex: number,
  key: string,
): { extracted: ExtractedLabelData; boundingBoxes: BoundingBoxMap } {
  const json = JSON.parse(fs.readFileSync(visionPath, "utf-8"))
  const result = json?.responses?.[0]
  const text: string = result?.fullTextAnnotation?.text ?? ""
  const page = result?.fullTextAnnotation?.pages?.[0]
  const W: number = page?.width ?? 0
  const H: number = page?.height ?? 0

  const words = ((page?.blocks ?? []) as { paragraphs?: { words?: VisionWord[] }[] }[])
    .flatMap((b) => b.paragraphs ?? [])
    .flatMap((p) => p.words ?? [])
    .map((w) => {
      const wordText = (w.symbols ?? []).map((s) => s.text).join("")
      const vertices = w.boundingBox?.vertices ?? []
      const xs = vertices.map((v) => v.x ?? 0)
      const ys = vertices.map((v) => v.y ?? 0)
      return {
        text: wordText,
        bbox: {
          x0: Math.min(...xs),
          y0: Math.min(...ys),
          x1: Math.max(...xs),
          y1: Math.max(...ys),
        },
      }
    })

  const hints = SEED_HINTS[key]
  const extracted = extractFields(text, hints)

  const boundingBoxes: BoundingBoxMap = {}
  for (const field of Object.keys(extracted) as (keyof ExtractedLabelData)[]) {
    const bbox = computeFieldBbox(words, extracted[field], W, H)
    boundingBoxes[field] = bbox ? { ...bbox, imageIndex } : null
  }

  return { extracted, boundingBoxes }
}

function run() {
  const visionFiles = fs
    .readdirSync(LABELS_DIR)
    .filter((f) => f.endsWith(".vision.json"))
    .sort()

  const output: Record<string, { imageIndex: number; extracted: ExtractedLabelData; boundingBoxes: BoundingBoxMap }> = {}

  for (const file of visionFiles) {
    const key = file.replace(".vision.json", "")
    const imageIndex = key.endsWith("-back") ? 1 : 0
    const visionPath = path.join(LABELS_DIR, file)
    const hasHints = !!SEED_HINTS[key]
    console.log(`Processing ${file}… ${hasHints ? "(guided)" : "(blind)"}`)
    const { extracted, boundingBoxes } = processVisionFile(visionPath, imageIndex, key)
    output[key] = { imageIndex, extracted, boundingBoxes }
    console.log(`  brandName: ${extracted.brandName ?? "(null)"}`)
    console.log(`  classType: ${extracted.classType ?? "(null)"}`)
    console.log(`  abv:       ${extracted.abv ?? "(null)"}`)
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2))
  console.log(`\nWrote ${OUT_PATH}`)
}

run()
