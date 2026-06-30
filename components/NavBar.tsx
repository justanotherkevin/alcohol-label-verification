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

export default function NavBar() {
  const pathname = usePathname()
  const [providerLabel, setProviderLabel] = useState("Tesseract")

  useEffect(() => {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as { provider?: string }
      setProviderLabel(PROVIDER_LABELS[parsed.provider ?? "tesseract"] ?? "Tesseract")
    }
  }, [pathname])

  const navLink = (href: string, label: string) => (
    <Link
      href={href}
      className={`text-sm font-medium transition-colors ${
        pathname === href ? "text-blue-600" : "text-gray-600 hover:text-gray-900"
      }`}
    >
      {label}
    </Link>
  )

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 flex items-center gap-6 h-12">
        <span className="font-semibold text-gray-900 text-sm">TTB Label Verification</span>
        {navLink("/", "Single")}
        {navLink("/batch", "Batch")}
        {navLink("/settings", "Settings")}
        <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
          Using: {providerLabel}
        </span>
      </div>
    </nav>
  )
}
