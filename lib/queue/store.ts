import { QueueApplication, QueueSummary, Resolution } from "./types"
import { SEED_APPLICATIONS } from "./seed-data"
import { MOCK_QUEUE_TEMPLATES } from "./mock-templates"
import { isFieldFlagged } from "./field-status"

let applications: QueueApplication[] = SEED_APPLICATIONS.map((app) => ({ ...app }))
let templateCursor = 0
let nextIdSuffix = 2000

export function listQueue(): QueueSummary[] {
  return applications
    .filter((app) => app.status !== "resolved")
    .map((app) => ({
      id: app.id,
      brandName: app.brandName,
      applicant: app.applicant,
      submittedAt: app.submittedAt,
      status: app.status,
      flagCount: app.analysis ? app.analysis.result.fields.filter(isFieldFlagged).length : 0,
      overallPass: app.analysis ? app.analysis.result.overallPass : null,
    }))
    .sort((a, b) => b.flagCount - a.flagCount)
}

export function getApplication(id: string): QueueApplication | undefined {
  return applications.find((app) => app.id === id)
}

export function addApplication(app: QueueApplication): void {
  applications.push(app)
}

export function updateApplication(
  id: string,
  patch: Partial<QueueApplication>
): QueueApplication | undefined {
  const idx = applications.findIndex((app) => app.id === id)
  if (idx === -1) return undefined
  applications[idx] = { ...applications[idx], ...patch }
  return applications[idx]
}

export function unanalyzedApplications(): QueueApplication[] {
  return applications.filter((app) => app.status === "pending")
}

export function resolveApplication(id: string, resolution: Resolution): QueueApplication | undefined {
  return updateApplication(id, { status: "resolved", resolution })
}

export function addMockApplication(): QueueApplication {
  const template = MOCK_QUEUE_TEMPLATES[templateCursor % MOCK_QUEUE_TEMPLATES.length]
  templateCursor += 1
  nextIdSuffix += 1
  const app: QueueApplication = {
    ...template,
    id: `TTB-2026-${nextIdSuffix}`,
    submittedAt: new Date().toISOString(),
    status: "pending",
    analysis: null,
    resolution: null,
  }
  applications.push(app)
  return app
}

/** Test-only: reset the store back to its seeded state between test runs. */
export function __resetQueueForTests(): void {
  applications = SEED_APPLICATIONS.map((app) => ({ ...app }))
  templateCursor = 0
  nextIdSuffix = 2000
}
