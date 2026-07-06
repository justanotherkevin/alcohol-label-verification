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

export type FieldSeverity = "pass" | "warn" | "fail"

/**
 * Aggregate status used to color a field's box on the label image and its
 * table row: a hard fail on either check wins, then anything short of a
 * clean pass on both checks is a warning.
 */
export function fieldSeverity(field: FieldResult): FieldSeverity {
  if (field.status === "fail" || field.regulatory?.status === "fail") return "fail"
  if (field.status === "missing" || field.regulatory?.status === "warning") return "warn"
  return "pass"
}

/**
 * Same as `fieldSeverity`, but accounts for a reviewer's live override: an
 * "approve" override always reads as a pass, a "flag" override always reads
 * as a fail, regardless of the field's natural OCR/regulatory result.
 */
export function effectiveSeverity(
  field: FieldResult,
  override: { decision?: "approve" | "flag" } | undefined,
): FieldSeverity {
  if (override?.decision === "approve") return "pass"
  if (override?.decision === "flag") return "fail"
  return fieldSeverity(field)
}
