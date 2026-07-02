import { NextRequest } from "next/server"
import { getProvider } from "@/lib/ocr"
import { verifyLabel, ApplicationData } from "@/lib/verify"
import { addApplication } from "@/lib/queue/store"
import { QueueApplication } from "@/lib/queue/types"
import { isFieldFlagged } from "@/lib/queue/field-status"

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

  let rows: CsvRow[]
  try {
    rows = JSON.parse(rowsRaw)
  } catch {
    return new Response("Invalid rows JSON", { status: 400 })
  }

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

          let queueId: string | undefined
          if (result.fields.some((f) => isFieldFlagged(f))) {
            queueId = `TTB-BATCH-${Date.now()}-${i}`
            const queueApp: QueueApplication = {
              id: queueId,
              applicant: appData.bottler || "Batch import",
              submittedAt: new Date().toISOString(),
              applicationData: appData,
              images: [{ base64: imageData.base64, mimeType: imageData.mimeType }],
              status: "analyzed",
              ocrData: {
                extracted: ocrResult.data,
                confidence: ocrResult.confidence,
                boundingBoxes: ocrResult.boundingBoxes,
                result,
                analyzedAt: new Date().toISOString(),
              },
              reviewData: { sessions: [], fieldNotes: [], resolution: null },
            }
            await addApplication(queueApp)
          }

          controller.enqueue(
            encoder.encode(
              sseEvent({
                type: "result",
                index: i,
                filename,
                extracted: ocrResult.data,
                confidence: ocrResult.confidence,
                result,
                queueId,
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
