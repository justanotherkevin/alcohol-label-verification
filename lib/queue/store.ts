import { pool } from "@/lib/db";
import { verifyLabel, ApplicationData } from "@/lib/verify";
import { isFieldFlagged } from "./field-status";
import {
  QueueApplication,
  QueueSummary,
  QueueStatus,
  Resolution,
  ApplicationReviewData,
  LabelImage,
  OcrData,
} from "./types";

// ── Assembly helper ───────────────────────────────────────────────────────────

async function assembleApplication(
  id: string,
): Promise<QueueApplication | undefined> {
  const appRes = await pool.query(
    `SELECT * FROM applications WHERE id = $1`,
    [id],
  );
  if (!appRes.rows.length) return undefined;
  const app = appRes.rows[0];

  // Five independent reads, no transaction needed — each goes through
  // pool.query() (its own pooled connection) rather than a single shared
  // client, so they run genuinely in parallel instead of being serialized
  // (and deprecation-warned) on one connection.
  const [dataRes, imagesRes, sessionsRes, notesRes, resRes] =
    await Promise.all([
      pool.query(
        `SELECT * FROM application_data WHERE application_id = $1`,
        [id],
      ),
      pool.query(
        `SELECT * FROM application_images WHERE application_id = $1 ORDER BY position`,
        [id],
      ),
      pool.query(
        `SELECT * FROM review_sessions WHERE application_id = $1 ORDER BY started_at`,
        [id],
      ),
      pool.query(
        `SELECT * FROM field_notes WHERE application_id = $1 ORDER BY saved_at`,
        [id],
      ),
      pool.query(`SELECT * FROM resolutions WHERE application_id = $1`, [
        id,
      ]),
    ]);

  const dr = dataRes.rows[0];
  const applicationData: ApplicationData = {
    brandName: dr?.brand_name ?? "",
    classType: dr?.class_type ?? "",
    abv: dr?.abv ?? "",
    netContents: dr?.net_contents ?? "",
    bottler: dr?.bottler ?? "",
    countryOfOrigin: dr?.country_of_origin ?? "",
    governmentWarning: dr?.government_warning ?? "",
  };

  const images: LabelImage[] = imagesRes.rows.map((r) => ({
    path: r.image_path,
    mimeType: r.mime_type,
    side: r.side ?? undefined,
    rawOcrText: r.raw_ocr_text ?? undefined,
  }));

  let ocrData: OcrData | null = null;
  const primaryImage = imagesRes.rows.find((r) => r.position === 0);
  if (primaryImage) {
    const ocrRes = await pool.query(
      `SELECT * FROM ocr_data WHERE application_image_id = $1`,
      [primaryImage.id],
    );
    if (ocrRes.rows.length > 0) {
      const ocr = ocrRes.rows[0];
      const d = ocr.data;
      const result = verifyLabel(
        applicationData,
        d.extracted,
        d.confidence ?? {},
      );
      ocrData = {
        extracted: d.extracted,
        confidence: d.confidence ?? {},
        boundingBoxes: d.boundingBoxes,
        result,
        analyzedAt: ocr.analyzed_at,
      };
    }
  }

  const reviewData: ApplicationReviewData = {
    sessions: sessionsRes.rows.map((r) => ({
      specialistId: r.specialist_id,
      startedAt: r.started_at,
      completedAt: r.completed_at ?? undefined,
    })),
    fieldNotes: notesRes.rows.map((r) => ({
      field: r.field,
      note: r.note,
      flagged: r.flagged,
      decision: r.decision ?? undefined,
      specialistId: r.specialist_id,
      savedAt: r.saved_at,
    })),
    resolution:
      resRes.rows.length > 0 ?
        {
          decision: resRes.rows[0].decision,
          overrides: resRes.rows[0].overrides,
          rejectedFields: resRes.rows[0].rejected_fields,
          note: resRes.rows[0].note,
          resolvedAt: resRes.rows[0].resolved_at,
          specialistId: resRes.rows[0].specialist_id ?? undefined,
        }
      : null,
  };

  return {
    id: app.id,
    applicant: app.applicant,
    submittedAt: app.submitted_at,
    applicationData,
    images,
    status: app.status,
    ocrData,
    reviewData,
    batchId: app.batch_id ?? undefined,
    errorMessage: app.error_message ?? undefined,
  };
}

// ── Insert helper (used by addApplication and seedDatabase) ──────────────────

async function insertApplication(app: QueueApplication): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO applications (id, applicant, submitted_at, status, batch_id) VALUES ($1, $2, $3, $4, $5)`,
      [app.id, app.applicant, app.submittedAt, app.status, app.batchId ?? null],
    );

    await client.query(
      `INSERT INTO application_data
         (application_id, brand_name, class_type, abv, net_contents, bottler, country_of_origin, government_warning)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        app.id,
        app.applicationData.brandName,
        app.applicationData.classType,
        app.applicationData.abv,
        app.applicationData.netContents,
        app.applicationData.bottler,
        app.applicationData.countryOfOrigin,
        app.applicationData.governmentWarning,
      ],
    );

    for (const [i, img] of app.images.entries()) {
      const imgRes = await client.query(
        `INSERT INTO application_images (application_id, position, image_path, mime_type, side, raw_ocr_text)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [
          app.id,
          i,
          img.path,
          img.mimeType,
          img.side ?? null,
          img.rawOcrText ?? null,
        ],
      );

      if (i === 0 && app.ocrData) {
        const ocrPayload = {
          extracted: app.ocrData.extracted,
          confidence: app.ocrData.confidence,
          boundingBoxes: app.ocrData.boundingBoxes,
        };
        await client.query(
          `INSERT INTO ocr_data (application_image_id, data, analyzed_at) VALUES ($1, $2, $3)`,
          [
            imgRes.rows[0].id,
            JSON.stringify(ocrPayload),
            app.ocrData.analyzedAt,
          ],
        );
      }
    }

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface QueueStatusCounts {
  pending: number;
  flagged: number;
  clean: number;
}

export interface QueuePage {
  items: QueueSummary[];
  total: number;
  counts: QueueStatusCounts;
}

export async function listQueue(
  page = 1,
  pageSize = 25,
  applicant?: string,
): Promise<QueuePage> {
  // Applicant-scoped queries (the applicant portal home screen) show that
  // applicant's full history, including resolved applications; the specialist
  // queue otherwise only ever shows active (unresolved) work. Batch-upload
  // rows still awaiting their turn in the chunk runner (batch_id set,
  // status still 'pending') are intake-stage only — they're not yet
  // reviewable and shouldn't inflate the dashboard's pending count; they
  // appear once the batch runner moves them to 'analyzed' (flagged) or
  // resolves them (clean/auto-approved).
  const whereClause =
    applicant ? `a.applicant = $1`
    : `a.status != 'resolved' AND (a.batch_id IS NULL OR a.status != 'pending')`;
  const params = applicant ? [applicant] : [];
  const { rows } = await pool.query(
    `
    SELECT
      a.id, a.applicant, a.submitted_at, a.status,
      COALESCE(ad.brand_name, a.applicant) AS brand_name,
      ad.class_type, ad.abv, ad.net_contents,
      ad.bottler, ad.country_of_origin, ad.government_warning,
      od.data AS ocr_json
    FROM applications a
    LEFT JOIN application_data ad ON ad.application_id = a.id
    LEFT JOIN application_images ai ON ai.application_id = a.id AND ai.position = 0
    LEFT JOIN ocr_data od ON od.application_image_id = ai.id
    WHERE ${whereClause}
  `,
    params,
  );

  const summaries = rows
    .map((row) => {
      let flagCount = 0;
      let overallPass: boolean | null = null;

      if (row.ocr_json) {
        const appData: ApplicationData = {
          brandName: row.brand_name ?? "",
          classType: row.class_type ?? "",
          abv: row.abv ?? "",
          netContents: row.net_contents ?? "",
          bottler: row.bottler ?? "",
          countryOfOrigin: row.country_of_origin ?? "",
          governmentWarning: row.government_warning ?? "",
        };
        const result = verifyLabel(
          appData,
          row.ocr_json.extracted,
          row.ocr_json.confidence ?? {},
        );
        flagCount = result.fields.filter(isFieldFlagged).length;
        overallPass = result.overallPass;
      }

      return {
        id: row.id,
        brandName: row.brand_name ?? row.applicant,
        applicant: row.applicant,
        submittedAt: row.submitted_at,
        status: row.status as QueueStatus,
        flagCount,
        overallPass,
      };
    })
    .sort((a, b) => b.flagCount - a.flagCount);

  const counts = summaries.reduce<QueueStatusCounts>(
    (acc, item) => {
      if (item.status === "pending") acc.pending++;
      else if (item.status === "analyzed" && item.flagCount > 0) acc.flagged++;
      else if (item.status === "analyzed" && item.flagCount === 0) acc.clean++;
      return acc;
    },
    { pending: 0, flagged: 0, clean: 0 },
  );

  const offset = (page - 1) * pageSize;
  return {
    items: summaries.slice(offset, offset + pageSize),
    total: summaries.length,
    counts,
  };
}

export async function getApplication(
  id: string,
): Promise<QueueApplication | undefined> {
  return assembleApplication(id);
}

export async function addApplication(app: QueueApplication): Promise<void> {
  await insertApplication(app);
}

export async function updateApplication(
  id: string,
  patch: Partial<QueueApplication>,
): Promise<QueueApplication | undefined> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (patch.status !== undefined) {
      await client.query(`UPDATE applications SET status = $1 WHERE id = $2`, [
        patch.status,
        id,
      ]);
    }

    if (patch.errorMessage !== undefined) {
      await client.query(
        `UPDATE applications SET error_message = $1 WHERE id = $2`,
        [patch.errorMessage, id],
      );
    }

    if (patch.images) {
      for (const [i, img] of patch.images.entries()) {
        await client.query(
          `UPDATE application_images SET image_path = $1, mime_type = $2, raw_ocr_text = $3
           WHERE application_id = $4 AND position = $5`,
          [img.path, img.mimeType, img.rawOcrText ?? null, id, i],
        );
      }
    }

    if (patch.ocrData) {
      const imgRes = await client.query(
        `SELECT id FROM application_images WHERE application_id = $1 AND position = 0`,
        [id],
      );
      if (imgRes.rows.length > 0) {
        const ocrPayload = {
          extracted: patch.ocrData.extracted,
          confidence: patch.ocrData.confidence,
          boundingBoxes: patch.ocrData.boundingBoxes,
        };
        await client.query(
          `INSERT INTO ocr_data (application_image_id, data, analyzed_at)
           VALUES ($1, $2, $3)
           ON CONFLICT (application_image_id) DO UPDATE
             SET data = EXCLUDED.data, analyzed_at = EXCLUDED.analyzed_at`,
          [
            imgRes.rows[0].id,
            JSON.stringify(ocrPayload),
            patch.ocrData.analyzedAt,
          ],
        );
      }
    }

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  return assembleApplication(id);
}

export async function unanalyzedApplications(): Promise<QueueApplication[]> {
  // Batch-upload rows (batch_id IS NOT NULL) are processed exclusively by the
  // batch chunk runner, never by the cron/manual pre-analysis trigger — they
  // may be analyzed with a different provider than the cron's default, and
  // double-processing would race the two paths against the same row.
  const { rows } = await pool.query(
    `SELECT id FROM applications WHERE status = 'pending' AND batch_id IS NULL`,
  );
  return Promise.all(
    rows.map((r) => assembleApplication(r.id).then((a) => a!)),
  );
}

export async function resolveApplication(
  id: string,
  resolution: Resolution,
): Promise<QueueApplication | undefined> {
  await pool.query(
    `INSERT INTO resolutions
       (application_id, decision, overrides, rejected_fields, note, resolved_at, specialist_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (application_id) DO UPDATE SET
       decision = EXCLUDED.decision,
       overrides = EXCLUDED.overrides,
       rejected_fields = EXCLUDED.rejected_fields,
       note = EXCLUDED.note,
       resolved_at = EXCLUDED.resolved_at,
       specialist_id = EXCLUDED.specialist_id`,
    [
      id,
      resolution.decision,
      JSON.stringify(resolution.overrides),
      JSON.stringify(resolution.rejectedFields),
      resolution.note,
      resolution.resolvedAt,
      resolution.specialistId ?? null,
    ],
  );
  await pool.query(
    `UPDATE applications SET status = 'resolved' WHERE id = $1`,
    [id],
  );
  return assembleApplication(id);
}

export async function revertResolution(
  id: string,
): Promise<QueueApplication | undefined> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // prototype: revert is destructive; the resolution row is discarded, no history is preserved
    await client.query(`DELETE FROM resolutions WHERE application_id = $1`, [
      id,
    ]);
    await client.query(
      `UPDATE applications SET status = 'analyzed' WHERE id = $1`,
      [id],
    );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  return assembleApplication(id);
}

export async function addMockApplication(): Promise<QueueApplication> {
  const { SEED_APPLICATIONS } = await import("./seed-data");
  const template =
    SEED_APPLICATIONS[Math.floor(Math.random() * SEED_APPLICATIONS.length)];
  const id = `demo-TTB-2026-${Date.now()}`;
  const app: QueueApplication = {
    applicant: template.applicant,
    applicationData: template.applicationData,
    images: template.images,
    id,
    submittedAt: new Date().toISOString(),
    status: "pending",
    ocrData: null,
    reviewData: { sessions: [], fieldNotes: [], resolution: null },
  };
  await insertApplication(app);
  return app;
}

export async function listResolvedApplications(): Promise<QueueApplication[]> {
  const { rows } = await pool.query(
    `SELECT a.id FROM applications a
     JOIN resolutions r ON r.application_id = a.id
     WHERE a.status = 'resolved'
     ORDER BY r.resolved_at DESC`,
  );
  return Promise.all(
    rows.map((r) => assembleApplication(r.id).then((a) => a!)),
  );
}

export async function resetQueue(): Promise<void> {
  await pool.query(`DELETE FROM applications WHERE id LIKE 'demo-%'`);
  // Also clears any batch-upload test/demo data (id prefix "batch-") and its
  // parent submission_batches rows, so repeated batch-upload testing doesn't
  // accumulate stale rows across resets.
  await pool.query(`DELETE FROM submission_batches WHERE id LIKE 'batch-%'`);
  const { SEED_APPLICATIONS } = await import("./seed-data");
  for (const app of SEED_APPLICATIONS) {
    await insertApplication(app);
  }
}

export async function __resetQueueForTests(): Promise<void> {
  return resetQueue();
}

export interface BatchRun {
  id: number;
  triggeredBy: "cron" | "manual";
  analyzedCount: number;
  completedAt: string;
}

export async function recordBatchRun(
  triggeredBy: "cron" | "manual",
  analyzedCount: number,
): Promise<void> {
  await pool.query(
    `INSERT INTO batch_runs (triggered_by, analyzed_count, completed_at) VALUES ($1, $2, $3)`,
    [triggeredBy, analyzedCount, new Date().toISOString()],
  );
}

export async function getLastBatchRun(): Promise<BatchRun | null> {
  const { rows } = await pool.query(
    `SELECT * FROM batch_runs ORDER BY id DESC LIMIT 1`,
  );
  if (!rows.length) return null;
  const row = rows[0];
  return {
    id: row.id,
    triggeredBy: row.triggered_by,
    analyzedCount: row.analyzed_count,
    completedAt: row.completed_at,
  };
}

// ── Submission batches (Flow 2, CSV batch upload) ─────────────────────────────
// Unrelated to batch_runs above, which logs OCR pre-analysis sweeps, not
// importer submissions.

export interface CsvRowError {
  row: number;
  message: string;
}

export interface SubmissionBatch {
  id: string;
  uploadedAt: string;
  filename: string | null;
  totalCount: number;
  ocrProvider: string;
  status: "processing" | "completed";
  skippedRows: CsvRowError[];
}

export async function createSubmissionBatch(batch: {
  id: string;
  filename: string | null;
  totalCount: number;
  ocrProvider: string;
  skippedRows: CsvRowError[];
}): Promise<void> {
  await pool.query(
    `INSERT INTO submission_batches (id, uploaded_at, filename, total_count, ocr_provider, status, skipped_rows)
     VALUES ($1, $2, $3, $4, $5, 'processing', $6)`,
    [
      batch.id,
      new Date().toISOString(),
      batch.filename,
      batch.totalCount,
      batch.ocrProvider,
      JSON.stringify(batch.skippedRows),
    ],
  );
}

export async function getSubmissionBatch(
  id: string,
): Promise<SubmissionBatch | undefined> {
  const { rows } = await pool.query(
    `SELECT * FROM submission_batches WHERE id = $1`,
    [id],
  );
  if (!rows.length) return undefined;
  const row = rows[0];
  return {
    id: row.id,
    uploadedAt: row.uploaded_at,
    filename: row.filename,
    totalCount: row.total_count,
    ocrProvider: row.ocr_provider,
    status: row.status,
    skippedRows: row.skipped_rows,
  };
}

export async function completeSubmissionBatch(id: string): Promise<void> {
  await pool.query(
    `UPDATE submission_batches SET status = 'completed' WHERE id = $1`,
    [id],
  );
}

export interface BatchCounts {
  total: number;
  pending: number;
  flagged: number;
  clean: number;
  resolvedApproved: number;
  resolvedRejected: number;
  errors: number;
}

export async function getBatchCounts(batchId: string): Promise<BatchCounts> {
  const { rows } = await pool.query(
    `SELECT a.status, a.error_message, r.decision, r.note
     FROM applications a
     LEFT JOIN resolutions r ON r.application_id = a.id
     WHERE a.batch_id = $1`,
    [batchId],
  );

  const counts: BatchCounts = {
    total: rows.length,
    pending: 0,
    flagged: 0,
    clean: 0,
    resolvedApproved: 0,
    resolvedRejected: 0,
    errors: 0,
  };

  for (const row of rows) {
    if (row.error_message) {
      counts.errors++;
    } else if (row.status === "resolved") {
      if (row.note?.startsWith("Auto-approved:")) counts.clean++;
      else if (row.decision === "approved") counts.resolvedApproved++;
      else counts.resolvedRejected++;
    } else if (row.status === "analyzed") {
      counts.flagged++;
    } else {
      counts.pending++;
    }
  }

  return counts;
}

/** Up to `limit` rows in this batch still awaiting OCR analysis. Always
 * re-derived from the DB so chunk processing is resumable across reloads. */
export async function pendingBatchApplicationIds(
  batchId: string,
  limit: number,
): Promise<string[]> {
  const { rows } = await pool.query(
    `SELECT id FROM applications
     WHERE batch_id = $1 AND status = 'pending' AND error_message IS NULL
     LIMIT $2`,
    [batchId, limit],
  );
  return rows.map((r) => r.id);
}

/** Ids of rows in this batch still flagged (status 'analyzed', not yet
 * resolved) — used to launch a "Start batch review" session covering every
 * flagged row from a single CSV upload. */
export async function flaggedBatchApplicationIds(
  batchId: string,
): Promise<string[]> {
  const { rows } = await pool.query(
    `SELECT id FROM applications WHERE batch_id = $1 AND status = 'analyzed'`,
    [batchId],
  );
  return rows.map((r) => r.id);
}

export async function countPendingBatchApplications(
  batchId: string,
): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count FROM applications
     WHERE batch_id = $1 AND status = 'pending' AND error_message IS NULL`,
    [batchId],
  );
  return rows[0].count;
}

export interface BatchExportRow {
  id: string;
  brandName: string;
  abv: string;
  netContents: string;
  governmentWarning: string;
  verdict: string;
}

export async function listBatchExportRows(
  batchId: string,
): Promise<BatchExportRow[]> {
  const { rows } = await pool.query(
    `SELECT a.id, a.status, a.error_message, ad.brand_name, ad.abv, ad.net_contents,
            ad.government_warning, r.decision, r.note
     FROM applications a
     LEFT JOIN application_data ad ON ad.application_id = a.id
     LEFT JOIN resolutions r ON r.application_id = a.id
     WHERE a.batch_id = $1
     ORDER BY a.submitted_at`,
    [batchId],
  );

  return rows.map((row) => {
    let verdict = "Pending Review";
    if (row.error_message) verdict = "Error";
    else if (row.status === "resolved") {
      if (row.note?.startsWith("Auto-approved:")) verdict = "Passed";
      else verdict = row.decision === "approved" ? "Approved" : "Rejected";
    } else if (row.status === "pending") verdict = "Not Yet Processed";

    return {
      id: row.id,
      brandName: row.brand_name ?? "",
      abv: row.abv ?? "",
      netContents: row.net_contents ?? "",
      governmentWarning: row.government_warning ?? "",
      verdict,
    };
  });
}
