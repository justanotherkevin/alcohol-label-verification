import fs from "fs"
import path from "path"
import { LabelImage } from "./types"

function loadVisionText(relPath: string): string | undefined {
  const visionPath = path.join(process.cwd(), "tests", "mocks", relPath.replace(/\.(png|jpe?g)$/i, ".vision.json"))
  if (!fs.existsSync(visionPath)) return undefined
  try {
    const json = JSON.parse(fs.readFileSync(visionPath, "utf-8"))
    return json?.responses?.[0]?.fullTextAnnotation?.text ?? undefined
  } catch {
    return undefined
  }
}

export function loadMockImage(relPath: string): LabelImage {
  const filename = path.basename(relPath)
  const mimeType = relPath.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg"
  const side = relPath.includes("front") ? "front" : relPath.includes("back") ? "back" : undefined
  const rawOcrText = loadVisionText(relPath)
  return { path: `/demo-labels/${filename}`, mimeType, side, ...(rawOcrText ? { rawOcrText } : {}) }
}
