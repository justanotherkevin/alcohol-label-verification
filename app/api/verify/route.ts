import { NextRequest, NextResponse } from "next/server"
import { activeProvider } from "@/lib/ocr"
import { verifyLabel, ApplicationData } from "@/lib/verify"

export async function POST(req: NextRequest) {
  const formData = await req.formData()

  const image = formData.get("image") as File | null
  const appDataRaw = formData.get("appData") as string | null

  if (!image || !appDataRaw) {
    return NextResponse.json({ error: "Missing image or application data" }, { status: 400 })
  }

  const appData: ApplicationData = JSON.parse(appDataRaw)

  const arrayBuffer = await image.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString("base64")

  const extracted = await activeProvider.extract(base64, image.type)
  const result = verifyLabel(appData, extracted)

  return NextResponse.json({ extracted, result })
}
