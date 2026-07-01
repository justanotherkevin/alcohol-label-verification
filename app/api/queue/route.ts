import { NextResponse } from "next/server"
import { listQueue, addMockApplication } from "@/lib/queue/store"

export async function GET() {
  return NextResponse.json({ items: listQueue() })
}

export async function POST() {
  const app = addMockApplication()
  return NextResponse.json({ id: app.id }, { status: 201 })
}
