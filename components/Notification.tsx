"use client"

interface NotificationEntry {
  filename: string
  status: "pass" | "fail" | "error"
}

interface NotificationProps {
  total: number
  completed: number
  entries: NotificationEntry[]
  done: boolean
}

export default function Notification({ total, completed, entries, done }: NotificationProps) {
  const passed = entries.filter((e) => e.status === "pass").length
  const failed = entries.filter((e) => e.status !== "pass").length

  return (
    <div
      data-testid="notification-panel"
      className="fixed top-4 right-4 w-72 bg-surface-card border border-outline rounded-xl shadow-lg z-50 overflow-hidden"
    >
      <div className="px-4 py-3 border-b border-outline bg-surface-dim">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-on-surface">
            {done ? "Batch complete" : "Processing…"}
          </span>
          <span className="text-sm text-on-surface-muted">
            {completed} / {total}
          </span>
        </div>
        {done && (
          <p className="text-xs text-on-surface-muted mt-0.5">
            {passed} passed · {failed} failed
          </p>
        )}
      </div>
      <ul className="max-h-48 overflow-y-auto divide-y divide-outline">
        {[...entries]
          .reverse()
          .slice(0, 10)
          .map((entry, i) => (
            <li key={i} className="flex items-center gap-2 px-4 py-2 text-xs text-on-surface-dim">
              <span className={entry.status === "pass" ? "text-bp-success" : "text-bp-error"}>
                {entry.status === "pass" ? "✓" : "✗"}
              </span>
              <span className="truncate">{entry.filename}</span>
            </li>
          ))}
      </ul>
    </div>
  )
}
