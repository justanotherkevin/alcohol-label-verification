"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"

const SETTINGS_KEY = "ttb-ocr-settings"
const PROVIDER_LABELS: Record<string, string> = {
  tesseract: "Tesseract",
  claude: "Claude",
  gemini: "Gemini",
  openai: "OpenAI",
  mock: "Mock",
}

type NavItem = { href: string; icon: string; label: string }

const NAV_ITEMS: NavItem[] = [
  { href: "/",         icon: "dashboard",  label: "Dashboard" },
  { href: "/verify",   icon: "fact_check", label: "Verify Label" },
  { href: "/batch",    icon: "layers",     label: "Batch Review" },
  { href: "/audit",    icon: "history",    label: "Audit Log" },
  { href: "/settings", icon: "settings",   label: "Settings" },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [providerLabel, setProviderLabel] = useState("Tesseract")

  useEffect(() => {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { provider?: string }
        setProviderLabel(PROVIDER_LABELS[parsed.provider ?? "tesseract"] ?? "Tesseract")
      } catch { /* ignore malformed localStorage */ }
    }
  }, [pathname])

  return (
    <aside className="fixed left-0 top-0 w-64 h-screen bg-surface-dim border-r border-outline flex flex-col z-40">
      {/* Branding */}
      <div className="px-6 py-5 border-b border-outline">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-xl">verified</span>
          <div>
            <p className="text-xs font-semibold text-primary tracking-widest uppercase">TTB</p>
            <p className="text-xs text-on-surface-muted leading-tight">Label Verification</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map(({ href, icon, label }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-primary text-white"
                  : "text-on-surface-dim hover:bg-outline hover:text-on-surface"
              }`}
            >
              <span
                className={`material-symbols-outlined text-[20px] ${
                  active ? "text-white" : "text-on-surface-muted"
                }`}
              >
                {icon}
              </span>
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Provider badge */}
      <div className="px-4 py-4 border-t border-outline">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-outline">
          <span className="material-symbols-outlined text-[16px] text-on-surface-muted">memory</span>
          <div>
            <p className="text-xs text-on-surface-muted">OCR Engine</p>
            <p className="text-xs font-semibold text-on-surface">{providerLabel}</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
