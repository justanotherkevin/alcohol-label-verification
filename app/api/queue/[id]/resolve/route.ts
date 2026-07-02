import { NextRequest, NextResponse } from "next/server";
import { getApplication, resolveApplication } from "@/lib/queue/store";
import { validateResolution, ResolveRequestBody } from "@/lib/queue/resolve";
import { Resolution } from "@/lib/queue/types";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const app = await getApplication(id);
  if (!app || !app.ocrData) {
    return NextResponse.json(
      { error: "Application not found or not yet analyzed" },
      { status: 404 },
    );
  }

  const body = (await req.json()) as ResolveRequestBody;
  const outcome = validateResolution(app.ocrData, body);
  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }

  const resolution: Resolution = {
    decision: body.decision,
    overrides: body.overrides,
    rejectedFields: body.decision === "rejected" ? body.rejectedFields : [],
    note: body.note,
    resolvedAt: new Date().toISOString(),
    specialistId: body.specialistId,
  };

  const updated = await resolveApplication(id, resolution);
  return NextResponse.json({ application: updated });
}
