import Papa from "papaparse"
import { NextResponse } from "next/server"
import { getSubmissionBatch, listBatchExportRows } from "@/lib/queue/store"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const batch = await getSubmissionBatch(id)
  if (!batch) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 })
  }

  const rows = await listBatchExportRows(id)
  const csv = Papa.unparse(
    rows.map((row) => ({
      id: row.id,
      brand_name: row.brandName,
      abv: row.abv,
      net_contents: row.netContents,
      govt_warning: row.governmentWarning,
      verdict: row.verdict,
    }))
  )

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${id}-results.csv"`,
    },
  })
}
