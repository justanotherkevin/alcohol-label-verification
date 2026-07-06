"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { StoredApplicant } from "@/lib/queue/applicant";

interface ApplicantNavProps {
  applicant: StoredApplicant;
  onSwitchUser: () => void;
  onLogout: () => void;
}

const NAV_ITEMS = [
  { href: "/", label: "My Applications" },
  { href: "/apply", label: "Submit New" },
];

export default function ApplicantNav({
  applicant,
  onSwitchUser,
  onLogout,
}: ApplicantNavProps) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-10 border-b border-outline bg-surface-card/90 backdrop-blur supports-[backdrop-filter]:bg-surface-card/70 shadow-sm">
      <div className="max-w-5xl mx-auto px-8 py-4 flex items-center justify-between gap-6">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center size-9 rounded-lg bg-primary text-white">
              <span className="material-symbols-outlined text-xl">verified</span>
            </span>
            <p className="text-sm font-bold text-primary tracking-widest uppercase">
              TTB
            </p>
          </div>
          <nav className="flex items-center gap-1.5">
            {NAV_ITEMS.map(({ href, label }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`px-4 py-2.5 rounded-lg text-base font-semibold transition-colors cursor-pointer ${
                    active ?
                      "bg-primary text-white shadow-sm"
                    : "text-on-surface-dim hover:bg-surface-dim hover:text-on-surface"
                  }`}>
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 pl-1">
            <span
              aria-hidden="true"
              className="flex items-center justify-center size-8 rounded-full bg-surface-dim text-on-surface-dim text-sm font-bold uppercase">
              {applicant.name.charAt(0)}
            </span>
            <p className="text-base text-on-surface-muted whitespace-nowrap sr-only sm:not-sr-only">
              Signed in as{" "}
              <span className="font-semibold text-on-surface">
                {applicant.name}
              </span>
            </p>
          </div>
          <button
            onClick={onSwitchUser}
            className="px-4 py-2.5 text-base font-semibold border-2 border-outline rounded-lg text-on-surface-dim hover:bg-surface-dim hover:border-outline-variant transition-colors cursor-pointer focus:outline-2 focus:outline-offset-2 focus:outline-primary">
            Switch user
          </button>
          {/* <button
            onClick={onLogout}
            className="px-4 py-2.5 text-base font-semibold border-2 border-outline rounded-lg text-on-surface-dim hover:bg-surface transition-colors cursor-pointer focus:outline-2 focus:outline-offset-2 focus:outline-primary"
          >
            Log out
          </button> */}
        </div>
      </div>
    </header>
  );
}
