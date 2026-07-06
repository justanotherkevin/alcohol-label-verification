export interface DemoApplicant {
  id: string
  name: string
  initials: string
  color: string
}

export const DEMO_APPLICANTS: DemoApplicant[] = [
  { id: "hollow-creek-distillery", name: "Hollow Creek Distillery LLC", initials: "HC", color: "#8a5a2b" },
  { id: "abc-distillery-inc",      name: "ABC Distillery Inc.",         initials: "AD", color: "#4c6080" },
  { id: "12345-imports-llc",       name: "12345 Imports LLC",           initials: "12", color: "#2e7d55" },
  { id: "elderberry-oak",          name: "Elderberry & Oak Distillers", initials: "EO", color: "#7c4daa" },
  { id: "casamigos-spirits",       name: "Casamigos Spirits Company",   initials: "CS", color: "#c0692b" },
]

const APPLICANT_KEY = "ttb-applicant"

export interface StoredApplicant {
  id: string
  name: string
}

export function getCurrentApplicant(): StoredApplicant | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(APPLICANT_KEY)
    if (!raw) return null
    return JSON.parse(raw) as StoredApplicant
  } catch {
    return null
  }
}

export function setCurrentApplicant(applicant: StoredApplicant): void {
  localStorage.setItem(APPLICANT_KEY, JSON.stringify(applicant))
  localStorage.removeItem("ttb-specialist")
}

export function clearCurrentApplicant(): void {
  localStorage.removeItem(APPLICANT_KEY)
}
