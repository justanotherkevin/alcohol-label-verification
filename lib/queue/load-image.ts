import fs from "fs"
import path from "path"

export function loadMockImage(relPath: string): { imageBase64: string; imageMimeType: string } {
  const filePath = path.join(process.cwd(), "tests", "mocks", relPath)
  const buffer = fs.readFileSync(filePath)
  const imageMimeType = relPath.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg"
  return { imageBase64: buffer.toString("base64"), imageMimeType }
}
