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
  const filePath = path.join(process.cwd(), "tests", "mocks", relPath)
  const buffer = fs.readFileSync(filePath)
  const mimeType = relPath.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg"
  const side = relPath.includes("front") ? "front" : relPath.includes("back") ? "back" : undefined
  const rawOcrText = loadVisionText(relPath)
  return { base64: buffer.toString("base64"), mimeType, side, ...(rawOcrText ? { rawOcrText } : {}) }
}
