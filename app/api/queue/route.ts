import { NextResponse } from "next/server"
import { listQueue, addMockApplication } from "@/lib/queue/store"

export async function GET() {
  return NextResponse.json({ items: await listQueue() })
}

export async function POST() {
  const app = await addMockApplication()
  return NextResponse.json({ id: app.id }, { status: 201 })
}
