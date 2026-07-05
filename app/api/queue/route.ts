import { NextResponse } from "next/server"
import { listQueue, addMockApplication } from "@/lib/queue/store"

const DEFAULT_PAGE_SIZE = 25
const MAX_PAGE_SIZE = 100

export async function GET(request: Request) {
  const url = new URL(request.url)
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1)
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number(url.searchParams.get("pageSize")) || DEFAULT_PAGE_SIZE),
  )
  const { items, total, counts } = await listQueue(page, pageSize)
  return NextResponse.json({ items, total, page, pageSize, counts })
}

export async function POST() {
  const app = await addMockApplication()
  return NextResponse.json({ id: app.id }, { status: 201 })
}
