import { NextResponse } from "next/server"
import { listResolvedApplications } from "@/lib/queue/store"
import { specialistNameById, AuditEntry } from "@/lib/queue/specialist"

export async function GET() {
  const resolved = await listResolvedApplications()
  const entries: AuditEntry[] = resolved.map((app) => {
    const res = app.reviewData.resolution!
    return {
      id: app.id,
      timestamp: new Date(res.resolvedAt).toLocaleString("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
      product: app.applicationData.brandName ?? app.applicant,
      specialist: res.specialistId ? specialistNameById(res.specialistId) : "—",
      status: res.decision === "approved" ? "Compliant" : "Violation",
    }
  })
  return NextResponse.json({ entries })
}
