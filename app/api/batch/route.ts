import { NextRequest } from "next/server"
import { getProvider } from "@/lib/ocr"
import { verifyLabel, ApplicationData } from "@/lib/verify"

interface CsvRow extends ApplicationData {
  filename: string
}

function sseEvent(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`
}

export async function POST(request: NextRequest) {
  const providerName = request.headers.get("X-Ocr-Provider") ?? "tesseract"
  const apiKey = request.headers.get("X-Api-Key") ?? undefined

  const formData = await request.formData()
  const rowsRaw = formData.get("rows") as string | null
  if (!rowsRaw) {
    return new Response("Missing rows", { status: 400 })
  }

  const rows: CsvRow[] = JSON.parse(rowsRaw)

  const imageMap: Record<string, { base64: string; mimeType: string }> = {}
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("image:") && value instanceof File) {
      const filename = key.slice("image:".length)
      const buffer = await value.arrayBuffer()
      imageMap[filename] = {
        base64: Buffer.from(buffer).toString("base64"),
        mimeType: value.type,
      }
    }
  }

  const encoder = new TextEncoder()
  const provider = getProvider(providerName, apiKey)

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(sseEvent({ type: "start", total: rows.length })))

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const imageData = imageMap[row.filename]

        if (!imageData) {
          controller.enqueue(
            encoder.encode(
              sseEvent({
                type: "result",
                index: i,
                filename: row.filename,
                error: `Image file not found: ${row.filename}`,
              })
            )
          )
          continue
        }

        try {
          const { filename, ...appData } = row
          const ocrResult = await provider.extract(imageData.base64, imageData.mimeType)
          const result = verifyLabel(appData, ocrResult.data, ocrResult.confidence)
          controller.enqueue(
            encoder.encode(
              sseEvent({
                type: "result",
                index: i,
                filename,
                extracted: ocrResult.data,
                confidence: ocrResult.confidence,
                result,
              })
            )
          )
        } catch (err) {
          controller.enqueue(
            encoder.encode(
              sseEvent({
                type: "result",
                index: i,
                filename: row.filename,
                error: err instanceof Error ? err.message : "Unknown error",
              })
            )
          )
        }
      }

      controller.enqueue(encoder.encode(sseEvent({ type: "done" })))
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
