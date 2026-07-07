"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { StoredSpecialist, DEMO_SPECIALISTS } from "@/lib/queue/specialist";
import { PROVIDER_LABELS } from "@/lib/ocr/provider-labels";

const SETTINGS_KEY = "ttb-ocr-settings";

type NavItem = { href: string; icon: string; label: string };

const NAV_ITEMS: NavItem[] = [
  { href: "/", icon: "inbox", label: "Queue" },
  { href: "/queue/new", icon: "add", label: "New Application" },
  { href: "/batch", icon: "upload", label: "Batch Upload" },
  { href: "/audit", icon: "history", label: "Audit Log" },
  { href: "/settings", icon: "settings", label: "Settings" },
];

interface SidebarProps {
  onRequestLogin: () => void;
  onLogout: () => void;
  specialist: StoredSpecialist | null;
}

export default function Sidebar({
  onRequestLogin,
  onLogout,
  specialist,
}: SidebarProps) {
  const pathname = usePathname();
  const [providerLabel, setProviderLabel] = useState("Tesseract");

  useEffect(() => {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { provider?: string };
        setProviderLabel(
          PROVIDER_LABELS[parsed.provider ?? "tesseract"] ?? "Tesseract",
        );
      } catch {
        /* ignore malformed localStorage */
      }
    }
  }, [pathname]);

  const specialistColor =
    specialist ?
      (DEMO_SPECIALISTS.find((s) => s.id === specialist.id)?.color ?? "#4c6080")
    : "#4c6080";

  const specialistInitials =
    specialist ?
      specialist.name
        .split(" ")
        .map((w) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "?";

  return (
    <>
      <aside className="fixed left-0 top-0 w-64 h-screen bg-surface-dim border-r border-outline flex flex-col z-40">
        {/* Branding */}
        <div className="px-6 py-6 border-b border-outline">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-2xl">
              verified
            </span>
            <div>
              <p className="text-sm font-bold text-primary tracking-widest uppercase">
                TTB
              </p>
              <p className="text-sm text-on-surface-muted leading-tight">
                Label Verification
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map(({ href, icon, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-base font-semibold transition-colors cursor-pointer ${
                  active ?
                    "bg-primary text-white"
                  : "text-on-surface-dim hover:bg-outline hover:text-on-surface"
                }`}>
                <span
                  className={`material-symbols-outlined text-[24px] ${
                    active ? "text-white" : "text-on-surface-muted"
                  }`}>
                  {icon}
                </span>
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Specialist + Provider footer */}
        <div className="px-4 py-4 border-t border-outline space-y-3">
          {/* Active specialist */}
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-surface border border-outline">
            <span
              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
              style={{ backgroundColor: specialistColor }}>
              {specialistInitials}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-on-surface-muted">Signed in as</p>
              <p className="text-sm font-semibold text-on-surface truncate">
                {specialist?.name ?? "No specialist"}
              </p>
            </div>
            <button
              onClick={onRequestLogin}
              className="text-on-surface-muted hover:text-on-surface transition-colors shrink-0 p-2 cursor-pointer"
              title="Switch user">
              <span className="material-symbols-outlined text-[20px]">
                swap_horiz
              </span>
            </button>
            {/* <button
              onClick={onLogout}
              className="text-on-surface-muted hover:text-on-surface transition-colors shrink-0 p-2 cursor-pointer"
              title="Log out"
            >
              <span className="material-symbols-outlined text-[20px]">logout</span>
            </button> */}
          </div>

          {/* OCR provider */}
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-surface border border-outline">
            <span className="material-symbols-outlined text-[20px] text-on-surface-muted w-6 h-6">
              memory
            </span>
            <div>
              <p className="text-sm text-on-surface-muted">OCR Engine</p>
              <p className="text-sm font-semibold text-on-surface">
                {providerLabel}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
