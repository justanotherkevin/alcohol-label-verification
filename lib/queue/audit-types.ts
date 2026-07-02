export interface AuditSummary {
  totalReviews: number
  complianceRate: number // 0-100
  rejectedCount: number
  avgResponseHours: number
}

export interface ActivityItem {
  id: string
  icon: "upload" | "check" | "warning"
  color: "text-secondary" | "text-bp-success" | "text-bp-error"
  text: string
  timestamp: string
}

export function formatTimeAgo(iso: string, now: Date = new Date()): string {
  const diffMs = now.getTime() - new Date(iso).getTime()
  const diffMin = Math.max(0, Math.round(diffMs / 60000))
  if (diffMin < 1) return "just now"
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.round(diffHr / 24)
  return `${diffDay}d ago`
}
