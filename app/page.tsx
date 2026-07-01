const QUEUE_ITEMS = [
  { id: "TTB-2024-8841", name: "Whiskey Reserve 12yr",  officer: "M. Chen",   submitted: "2h ago",  status: "Under Review" },
  { id: "TTB-2024-8840", name: "Pacific Coast IPA",     officer: "J. Torres", submitted: "3h ago",  status: "Needs Attention" },
  { id: "TTB-2024-8839", name: "Sonoma Valley Pinot",   officer: "A. Patel",  submitted: "5h ago",  status: "In Queue" },
  { id: "TTB-2024-8838", name: "Blue Ridge Bourbon",    officer: "M. Chen",   submitted: "6h ago",  status: "Approved" },
  { id: "TTB-2024-8837", name: "Cascade Mountain Gin",  officer: "L. Kim",    submitted: "8h ago",  status: "Under Review" },
  { id: "TTB-2024-8836", name: "Gulf Coast White Wine", officer: "J. Torres", submitted: "10h ago", status: "In Queue" },
]

const STATUS_STYLES: Record<string, string> = {
  "Under Review":    "bg-blue-50 text-blue-700 border border-blue-200",
  "Needs Attention": "bg-bp-error-surface text-bp-error border border-bp-error-border",
  "Approved":        "bg-bp-success-surface text-bp-success border border-bp-success-border",
  "In Queue":        "bg-surface-dim text-on-surface-dim border border-outline",
}

const STATUS_DOT: Record<string, string> = {
  "Under Review":    "bg-blue-500",
  "Needs Attention": "bg-bp-error",
  "Approved":        "bg-bp-success",
  "In Queue":        "bg-on-surface-muted",
}

const METRICS = [
  { icon: "inbox",     label: "Pending Reviews", value: "24",    sub: "6 added today" },
  { icon: "speed",     label: "Daily Velocity",  value: "18",    sub: "Avg: 14 / day" },
  { icon: "warning",   label: "Needs Attention", value: "3",     sub: "Action required" },
  { icon: "bar_chart", label: "Total Processed", value: "1,284", sub: "This quarter" },
]

export default function DashboardPage() {
  return (
    <div className="px-8 py-8 max-w-7xl">
      <div className="mb-8">
        <h1
          className="text-2xl font-bold text-on-surface"
          style={{ fontFamily: "var(--font-inter)" }}
        >
          Verification Dashboard
        </h1>
        <p className="text-sm text-on-surface-muted mt-1">
          TTB COLA compliance review queue — updated just now
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {METRICS.map(({ icon, label, value, sub }) => (
          <div key={label} className="bg-surface-card border border-outline rounded-2xl p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-on-surface-muted font-medium uppercase tracking-wide">
                  {label}
                </p>
                <p
                  className="text-3xl font-bold text-on-surface mt-1"
                  style={{ fontFamily: "var(--font-inter)" }}
                >
                  {value}
                </p>
                <p className="text-xs text-on-surface-muted mt-1">{sub}</p>
              </div>
              <span className="material-symbols-outlined text-primary opacity-60 text-2xl">
                {icon}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Queue Table */}
      <div className="bg-surface-card border border-outline rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-outline flex items-center justify-between">
          <h2
            className="text-sm font-semibold text-on-surface"
            style={{ fontFamily: "var(--font-inter)" }}
          >
            Verification Queue
          </h2>
          <a
            href="/verify"
            className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary-hover transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            New Application
          </a>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-outline bg-surface-dim">
              {["App ID", "Label Name", "Officer", "Submitted", "Status", "Action"].map((h) => (
                <th
                  key={h}
                  className="px-6 py-3 text-left text-xs font-semibold text-on-surface-muted uppercase tracking-wider"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline">
            {QUEUE_ITEMS.map((item) => (
              <tr key={item.id} className="hover:bg-surface-dim transition-colors">
                <td className="px-6 py-4 font-mono text-xs text-on-surface-dim">{item.id}</td>
                <td className="px-6 py-4 text-sm font-medium text-on-surface">{item.name}</td>
                <td className="px-6 py-4 text-sm text-on-surface-dim">{item.officer}</td>
                <td className="px-6 py-4 text-sm text-on-surface-muted">{item.submitted}</td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[item.status]}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[item.status]}`} />
                    {item.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <a
                    href="/verify"
                    className="text-xs font-medium text-primary hover:text-primary-hover transition-colors"
                  >
                    Analyze →
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="px-6 py-3 border-t border-outline flex items-center justify-between">
          <p className="text-xs text-on-surface-muted">Showing 6 of 24 pending</p>
          <div className="flex gap-2">
            <button className="text-xs px-3 py-1.5 border border-outline rounded-lg text-on-surface-dim hover:bg-surface-dim transition-colors">
              Previous
            </button>
            <button className="text-xs px-3 py-1.5 border border-outline rounded-lg text-on-surface-dim hover:bg-surface-dim transition-colors">
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
