import { Resolution } from "./types"

export interface SeedResolution {
  /** Must match a "demo-*" id from SEED_APPLICATIONS (lib/queue/seed-data.ts) */
  applicationId: string
  resolution: Resolution
}

// Edit this list and re-run `npm run db:seed:resolutions` to reseed the
// audit log. Each run replaces the entire resolved set: applications
// previously marked resolved are reverted to "analyzed", all resolutions
// are cleared, then this list is (re-)applied from scratch.
export const SEED_RESOLUTIONS: SeedResolution[] = [
  {
    applicationId: "demo-TTB-2026-1001",
    resolution: {
      decision: "approved",
      overrides: [],
      rejectedFields: [],
      note: "All visible fields pass verification; approved as submitted.",
      resolvedAt: "2026-06-30T18:00:00.000Z",
      specialistId: "dave-morrison",
    },
  },
  {
    applicationId: "demo-TTB-2026-1002",
    resolution: {
      decision: "rejected",
      overrides: [],
      rejectedFields: ["brandName", "governmentWarning"],
      note: "Brand name OCR mismatch and government warning has trailing noise; sent back for a clearer label scan.",
      resolvedAt: "2026-06-30T19:15:00.000Z",
      specialistId: "jenny-park",
    },
  },
]
