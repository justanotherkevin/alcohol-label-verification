import { NextResponse } from "next/server"
import { getApplication } from "@/lib/queue/store"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const app = getApplication(id)
  if (!app) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 })
  }
  return NextResponse.json({ application: app })
}
