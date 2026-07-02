import { FieldOverride, QueueAnalysis } from "./types";
import { isFieldFlagged } from "./field-status";

export interface ResolveRequestBody {
  decision: "approved" | "rejected";
  overrides: FieldOverride[];
  rejectedFields: string[];
  note: string;
}

export type ValidationOutcome = { ok: true } | { ok: false; error: string };

export function validateResolution(
  analysis: QueueAnalysis,
  body: ResolveRequestBody,
): ValidationOutcome {
  const approvedFields = new Set(
    body.overrides
      .filter((o) => o.decision === "approve" || !o.decision)
      .map((o) => o.field),
  );
  const flaggedByOverride = new Set(
    body.overrides.filter((o) => o.decision === "flag").map((o) => o.field),
  );
  const stillFlagged = analysis.result.fields
    .filter(
      (f) =>
        (isFieldFlagged(f) && !approvedFields.has(f.field)) ||
        flaggedByOverride.has(f.field),
    )
    .map((f) => f.field);

  if (body.decision === "approved") {
    if (stillFlagged.length > 0) {
      return {
        ok: false,
        error: `Cannot approve: ${stillFlagged.length} field(s) still flagged: ${stillFlagged.join(", ")}`,
      };
    }
    return { ok: true };
  }

  if (body.rejectedFields.length === 0) {
    return {
      ok: false,
      error:
        "Rejection requires citing at least one field that is still flagged (not overridden)",
    };
  }
  const citedValid = body.rejectedFields.every((f) => stillFlagged.includes(f));
  if (!citedValid) {
    return {
      ok: false,
      error:
        "Rejection can only cite fields that are still flagged (not overridden)",
    };
  }
  if (!body.note.trim()) {
    return { ok: false, error: "Rejection requires a note" };
  }
  return { ok: true };
}
