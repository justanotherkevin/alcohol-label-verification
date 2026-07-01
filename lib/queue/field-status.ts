import { FieldResult } from "@/lib/verify"

/**
 * A field needs review (blocks approval, counts toward flag counts, routes a
 * batch row into the queue) if its text-match status isn't "pass", OR if it
 * passed the text match but failed a separate regulatory-bounds check (e.g.
 * ABV outside the legal range, non-standard fill size, unrecognized
 * class/type). `verifyLabel()`'s `overallPass` never accounts for the latter,
 * so every consumer of `FieldResult` in the queue layer must use this helper
 * instead of checking `status !== "pass"` alone.
 */
export function isFieldFlagged(field: FieldResult): boolean {
  return field.status !== "pass" || field.regulatory?.status === "fail"
}
