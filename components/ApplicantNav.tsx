"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { StoredApplicant } from "@/lib/queue/applicant"

interface ApplicantNavProps {
  applicant: StoredApplicant
  onSwitchUser: () => void
  onLogout: () => void
}

const NAV_ITEMS = [
  { href: "/", label: "My Applications" },
  { href: "/apply", label: "Submit New" },
]

export default function ApplicantNav({ applicant, onSwitchUser, onLogout }: ApplicantNavProps) {
  const pathname = usePathname()

  return (
    <header className="border-b border-outline bg-surface-dim">
      <div className="max-w-4xl mx-auto px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">verified</span>
            <p className="text-xs font-semibold text-primary tracking-widest uppercase">TTB</p>
          </div>
          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map(({ href, label }) => {
              const active = pathname === href
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? "bg-primary text-white"
                      : "text-on-surface-dim hover:bg-outline hover:text-on-surface"
                  }`}
                >
                  {label}
                </Link>
              )
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs text-on-surface-muted">
            Signed in as <span className="font-semibold text-on-surface">{applicant.name}</span>
          </p>
          <button
            onClick={onSwitchUser}
            className="text-xs px-3 py-1.5 border border-outline rounded-lg text-on-surface-dim hover:bg-surface transition-colors"
          >
            Switch user
          </button>
          <button
            onClick={onLogout}
            className="text-xs px-3 py-1.5 border border-outline rounded-lg text-on-surface-dim hover:bg-surface transition-colors"
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  )
}
