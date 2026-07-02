import { NextResponse } from "next/server";
import { listAuditEntries, getAuditSummary, getRecentActivity } from "@/lib/queue/audit";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number(url.searchParams.get("pageSize")) || DEFAULT_PAGE_SIZE),
  );

  const [{ entries, total }, summary, activity] = await Promise.all([
    listAuditEntries(page, pageSize),
    getAuditSummary(),
    getRecentActivity(),
  ]);
  return NextResponse.json({ entries, total, page, pageSize, summary, activity });
}
