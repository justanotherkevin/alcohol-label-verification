export interface DemoSpecialist {
  id: string
  name: string
  role: string
  initials: string
  color: string
}

export const DEMO_SPECIALISTS: DemoSpecialist[] = [
  { id: "jenny-park",      name: "Jenny Park",      role: "Junior Compliance Agent", initials: "JP", color: "#4c6080" },
  { id: "dave-morrison",   name: "Dave Morrison",   role: "Senior Compliance Agent", initials: "DM", color: "#2e7d55" },
  { id: "janet-seattle",   name: "Janet (Seattle)",  role: "Compliance Agent",        initials: "JS", color: "#7c4daa" },
  { id: "sarah-chen",      name: "Sarah Chen",      role: "Deputy Director",         initials: "SC", color: "#c0692b" },
  { id: "marcus-williams", name: "Marcus Williams", role: "IT Admin",                initials: "MW", color: "#1a7a7a" },
]

const SPECIALIST_KEY = "ttb-specialist"

export interface StoredSpecialist {
  id: string
  name: string
  role: string
}

export function getCurrentSpecialist(): StoredSpecialist | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(SPECIALIST_KEY)
    if (!raw) return null
    return JSON.parse(raw) as StoredSpecialist
  } catch {
    return null
  }
}

export function setCurrentSpecialist(specialist: StoredSpecialist): void {
  localStorage.setItem(SPECIALIST_KEY, JSON.stringify(specialist))
}

export function clearCurrentSpecialist(): void {
  localStorage.removeItem(SPECIALIST_KEY)
}

export function specialistNameById(id: string): string {
  return DEMO_SPECIALISTS.find((s) => s.id === id)?.name ?? id
}

export interface AuditEntry {
  id: string
  timestamp: string
  product: string
  specialist: string
  status: "Compliant" | "Violation"
}
