import { NextResponse } from "next/server"
import { getApplication, revertResolution } from "@/lib/queue/store"

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const app = await getApplication(id)
  if (!app) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 })
  }
  if (app.status !== "resolved") {
    return NextResponse.json({ error: "Application is not resolved" }, { status: 409 })
  }

  const updated = await revertResolution(id)
  return NextResponse.json({ application: updated })
}
