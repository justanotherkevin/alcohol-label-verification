import { NextRequest, NextResponse } from "next/server"
import { getProvider } from "@/lib/ocr"
import { verifyLabel, ApplicationData } from "@/lib/verify"

export async function POST(req: NextRequest) {
  const providerName = req.headers.get("X-Ocr-Provider") ?? "tesseract"
  const apiKey = req.headers.get("X-Api-Key") ?? undefined

  const formData = await req.formData()

  const image = formData.get("image") as File | null
  const appDataRaw = formData.get("appData") as string | null

  if (!image || !appDataRaw) {
    return NextResponse.json({ error: "Missing image or application data" }, { status: 400 })
  }

  const appData: ApplicationData = JSON.parse(appDataRaw)

  const arrayBuffer = await image.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString("base64")

  const provider = getProvider(providerName, apiKey)
  const ocrResult = await provider.extract(base64, image.type)
  const result = verifyLabel(appData, ocrResult.data)

  return NextResponse.json({ extracted: ocrResult.data, confidence: ocrResult.confidence, boundingBoxes: ocrResult.boundingBoxes, result })
}
