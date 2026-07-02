import { pool } from "@/lib/db"
import { verifyLabel, ApplicationData } from "@/lib/verify"
import { isFieldFlagged } from "./field-status"
import {
  QueueApplication,
  QueueSummary,
  Resolution,
  ApplicationReviewData,
  LabelImage,
  OcrData,
} from "./types"
import { MOCK_QUEUE_TEMPLATES } from "./mock-templates"

// ── Assembly helper ───────────────────────────────────────────────────────────

async function assembleApplication(id: string): Promise<QueueApplication | undefined> {
  const client = await pool.connect()
  try {
    const appRes = await client.query(`SELECT * FROM applications WHERE id = $1`, [id])
    if (!appRes.rows.length) return undefined
    const app = appRes.rows[0]

    const [dataRes, imagesRes, sessionsRes, notesRes, resRes] = await Promise.all([
      client.query(`SELECT * FROM application_data WHERE application_id = $1`, [id]),
      client.query(`SELECT * FROM application_images WHERE application_id = $1 ORDER BY position`, [id]),
      client.query(`SELECT * FROM review_sessions WHERE application_id = $1 ORDER BY started_at`, [id]),
      client.query(`SELECT * FROM field_notes WHERE application_id = $1 ORDER BY saved_at`, [id]),
      client.query(`SELECT * FROM resolutions WHERE application_id = $1`, [id]),
    ])

    const dr = dataRes.rows[0]
    const applicationData: ApplicationData = {
      brandName: dr?.brand_name ?? "",
      classType: dr?.class_type ?? "",
      abv: dr?.abv ?? "",
      netContents: dr?.net_contents ?? "",
      bottler: dr?.bottler ?? "",
      countryOfOrigin: dr?.country_of_origin ?? "",
      governmentWarning: dr?.government_warning ?? "",
    }

    const images: LabelImage[] = imagesRes.rows.map((r) => ({
      base64: r.base64,
      mimeType: r.mime_type,
      side: r.side ?? undefined,
      rawOcrText: r.raw_ocr_text ?? undefined,
    }))

    let ocrData: OcrData | null = null
    const primaryImage = imagesRes.rows.find((r) => r.position === 0)
    if (primaryImage) {
      const ocrRes = await client.query(
        `SELECT * FROM ocr_data WHERE application_image_id = $1`,
        [primaryImage.id]
      )
      if (ocrRes.rows.length > 0) {
        const ocr = ocrRes.rows[0]
        const d = ocr.data
        const result = verifyLabel(applicationData, d.extracted, d.confidence ?? {})
        ocrData = {
          extracted: d.extracted,
          confidence: d.confidence ?? {},
          boundingBoxes: d.boundingBoxes,
          result,
          analyzedAt: ocr.analyzed_at,
        }
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
        resRes.rows.length > 0
          ? {
              decision: resRes.rows[0].decision,
              overrides: resRes.rows[0].overrides,
              rejectedFields: resRes.rows[0].rejected_fields,
              note: resRes.rows[0].note,
              resolvedAt: resRes.rows[0].resolved_at,
              specialistId: resRes.rows[0].specialist_id ?? undefined,
            }
          : null,
    }

    return {
      id: app.id,
      applicant: app.applicant,
      submittedAt: app.submitted_at,
      applicationData,
      images,
      status: app.status,
      ocrData,
      reviewData,
    }
  } finally {
    client.release()
  }
}

// ── Insert helper (used by addApplication and seedDatabase) ──────────────────

async function insertApplication(app: QueueApplication): Promise<void> {
  const client = await pool.connect()
  try {
    await client.query("BEGIN")

    await client.query(
      `INSERT INTO applications (id, applicant, submitted_at, status) VALUES ($1, $2, $3, $4)`,
      [app.id, app.applicant, app.submittedAt, app.status]
    )

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
      ]
    )

    for (const [i, img] of app.images.entries()) {
      const imgRes = await client.query(
        `INSERT INTO application_images (application_id, position, base64, mime_type, side, raw_ocr_text)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [app.id, i, img.base64, img.mimeType, img.side ?? null, img.rawOcrText ?? null]
      )

      if (i === 0 && app.ocrData) {
        const ocrPayload = {
          extracted: app.ocrData.extracted,
          confidence: app.ocrData.confidence,
          boundingBoxes: app.ocrData.boundingBoxes,
        }
        await client.query(
          `INSERT INTO ocr_data (application_image_id, data, analyzed_at) VALUES ($1, $2, $3)`,
          [imgRes.rows[0].id, JSON.stringify(ocrPayload), app.ocrData.analyzedAt]
        )
      }
    }

    await client.query("COMMIT")
  } catch (e) {
    await client.query("ROLLBACK")
    throw e
  } finally {
    client.release()
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function listQueue(): Promise<QueueSummary[]> {
  const { rows } = await pool.query(`
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
    WHERE a.status != 'resolved'
  `)

  return rows
    .map((row) => {
      let flagCount = 0
      let overallPass: boolean | null = null

      if (row.ocr_json) {
        const appData: ApplicationData = {
          brandName: row.brand_name ?? "",
          classType: row.class_type ?? "",
          abv: row.abv ?? "",
          netContents: row.net_contents ?? "",
          bottler: row.bottler ?? "",
          countryOfOrigin: row.country_of_origin ?? "",
          governmentWarning: row.government_warning ?? "",
        }
        const result = verifyLabel(appData, row.ocr_json.extracted, row.ocr_json.confidence ?? {})
        flagCount = result.fields.filter(isFieldFlagged).length
        overallPass = result.overallPass
      }

      return {
        id: row.id,
        brandName: row.brand_name ?? row.applicant,
        applicant: row.applicant,
        submittedAt: row.submitted_at,
        status: row.status,
        flagCount,
        overallPass,
      }
    })
    .sort((a, b) => b.flagCount - a.flagCount)
}

export async function getApplication(id: string): Promise<QueueApplication | undefined> {
  return assembleApplication(id)
}

export async function addApplication(app: QueueApplication): Promise<void> {
  await insertApplication(app)
}

export async function updateApplication(
  id: string,
  patch: Partial<QueueApplication>
): Promise<QueueApplication | undefined> {
  const client = await pool.connect()
  try {
    await client.query("BEGIN")

    if (patch.status !== undefined) {
      await client.query(`UPDATE applications SET status = $1 WHERE id = $2`, [patch.status, id])
    }

    if (patch.images) {
      for (const [i, img] of patch.images.entries()) {
        await client.query(
          `UPDATE application_images SET raw_ocr_text = $1 WHERE application_id = $2 AND position = $3`,
          [img.rawOcrText ?? null, id, i]
        )
      }
    }

    if (patch.ocrData) {
      const imgRes = await client.query(
        `SELECT id FROM application_images WHERE application_id = $1 AND position = 0`,
        [id]
      )
      if (imgRes.rows.length > 0) {
        const ocrPayload = {
          extracted: patch.ocrData.extracted,
          confidence: patch.ocrData.confidence,
          boundingBoxes: patch.ocrData.boundingBoxes,
        }
        await client.query(
          `INSERT INTO ocr_data (application_image_id, data, analyzed_at)
           VALUES ($1, $2, $3)
           ON CONFLICT (application_image_id) DO UPDATE
             SET data = EXCLUDED.data, analyzed_at = EXCLUDED.analyzed_at`,
          [imgRes.rows[0].id, JSON.stringify(ocrPayload), patch.ocrData.analyzedAt]
        )
      }
    }

    await client.query("COMMIT")
  } catch (e) {
    await client.query("ROLLBACK")
    throw e
  } finally {
    client.release()
  }

  return assembleApplication(id)
}

export async function unanalyzedApplications(): Promise<QueueApplication[]> {
  const { rows } = await pool.query(
    `SELECT id FROM applications WHERE status = 'pending'`
  )
  return Promise.all(rows.map((r) => assembleApplication(r.id).then((a) => a!)))
}

export async function resolveApplication(
  id: string,
  resolution: Resolution
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
    ]
  )
  await pool.query(`UPDATE applications SET status = 'resolved' WHERE id = $1`, [id])
  return assembleApplication(id)
}

let templateCursor = 0

export async function addMockApplication(): Promise<QueueApplication> {
  const template = MOCK_QUEUE_TEMPLATES[templateCursor % MOCK_QUEUE_TEMPLATES.length]
  templateCursor++
  const id = `TTB-2026-${Date.now()}`
  const app: QueueApplication = {
    ...template,
    id,
    submittedAt: new Date().toISOString(),
    status: "pending",
    ocrData: null,
    reviewData: { sessions: [], fieldNotes: [], resolution: null },
  }
  await insertApplication(app)
  return app
}

export async function listResolvedApplications(): Promise<QueueApplication[]> {
  const { rows } = await pool.query(
    `SELECT a.id FROM applications a
     JOIN resolutions r ON r.application_id = a.id
     WHERE a.status = 'resolved'
     ORDER BY r.resolved_at DESC`
  )
  return Promise.all(rows.map((r) => assembleApplication(r.id).then((a) => a!)))
}

export async function resetQueue(): Promise<void> {
  await pool.query(`DELETE FROM applications`)
  templateCursor = 0
  const { SEED_APPLICATIONS } = await import("./seed-data")
  for (const app of SEED_APPLICATIONS) {
    await insertApplication(app)
  }
}

export async function __resetQueueForTests(): Promise<void> {
  return resetQueue()
}
