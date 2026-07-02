import { pool } from "@/lib/db"
import { AuditSummary, ActivityItem } from "./audit-types"
import { AuditEntry, specialistNameById } from "./specialist"

export type { AuditSummary, ActivityItem } from "./audit-types"

export interface AuditEntryPage {
  entries: AuditEntry[]
  total: number
}

export async function listAuditEntries(page = 1, pageSize = 25): Promise<AuditEntryPage> {
  const offset = (page - 1) * pageSize
  const [entriesRes, countRes] = await Promise.all([
    pool.query(
      `SELECT r.application_id, r.decision, r.resolved_at, r.specialist_id,
              COALESCE(ad.brand_name, a.applicant) AS product
       FROM resolutions r
       JOIN applications a ON a.id = r.application_id
       LEFT JOIN application_data ad ON ad.application_id = a.id
       ORDER BY r.resolved_at DESC
       LIMIT $1 OFFSET $2`,
      [pageSize, offset],
    ),
    pool.query(`SELECT COUNT(*)::int AS total FROM resolutions`),
  ])

  const entries: AuditEntry[] = entriesRes.rows.map((r) => ({
    id: r.application_id,
    timestamp: new Date(r.resolved_at).toLocaleString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
    product: r.product,
    specialist: r.specialist_id ? specialistNameById(r.specialist_id) : "—",
    status: r.decision === "approved" ? "Compliant" : "Violation",
  }))

  return { entries, total: countRes.rows[0].total }
}

export async function getAuditSummary(): Promise<AuditSummary> {
  const { rows } = await pool.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE decision = 'approved')::int AS approved,
      COUNT(*) FILTER (WHERE decision = 'rejected')::int AS rejected,
      AVG(EXTRACT(EPOCH FROM (r.resolved_at - a.submitted_at)) / 3600.0) AS avg_hours
    FROM resolutions r
    JOIN applications a ON a.id = r.application_id
  `)
  const row = rows[0]
  const total: number = row.total ?? 0
  return {
    totalReviews: total,
    complianceRate: total > 0 ? Math.round((row.approved / total) * 1000) / 10 : 0,
    rejectedCount: row.rejected ?? 0,
    avgResponseHours: row.avg_hours != null ? Math.round(row.avg_hours * 10) / 10 : 0,
  }
}

export async function getRecentActivity(limit = 8): Promise<ActivityItem[]> {
  const [resolutionsRes, submissionsRes] = await Promise.all([
    pool.query(
      `SELECT r.application_id, r.decision, r.resolved_at,
              COALESCE(ad.brand_name, a.applicant) AS product
       FROM resolutions r
       JOIN applications a ON a.id = r.application_id
       LEFT JOIN application_data ad ON ad.application_id = a.id
       ORDER BY r.resolved_at DESC LIMIT $1`,
      [limit]
    ),
    pool.query(
      `SELECT a.id, a.submitted_at, COALESCE(ad.brand_name, a.applicant) AS product
       FROM applications a
       LEFT JOIN application_data ad ON ad.application_id = a.id
       ORDER BY a.submitted_at DESC LIMIT $1`,
      [limit]
    ),
  ])

  const items: ActivityItem[] = [
    ...resolutionsRes.rows.map((r) => ({
      id: `res-${r.application_id}`,
      icon: r.decision === "approved" ? ("check" as const) : ("warning" as const),
      color: r.decision === "approved" ? ("text-bp-success" as const) : ("text-bp-error" as const),
      text: `${r.application_id} ${r.decision === "approved" ? "approved" : "rejected"}`,
      timestamp: r.resolved_at,
    })),
    ...submissionsRes.rows.map((r) => ({
      id: `sub-${r.id}`,
      icon: "upload" as const,
      color: "text-secondary" as const,
      text: `${r.product} submitted`,
      timestamp: r.submitted_at,
    })),
  ]

  return items
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit)
}
