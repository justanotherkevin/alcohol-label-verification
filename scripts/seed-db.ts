import { pool } from "../lib/db"
import { SEED_APPLICATIONS } from "../lib/queue/seed-data"

async function seed() {
  await pool.query(`DELETE FROM applications`)

  for (const app of SEED_APPLICATIONS) {
    const client = await pool.connect()
    try {
      await client.query("BEGIN")

      await client.query(
        `INSERT INTO applications (id, applicant, submitted_at, status) VALUES ($1,$2,$3,$4)`,
        [app.id, app.applicant, app.submittedAt, app.status]
      )

      const ad = app.applicationData
      await client.query(
        `INSERT INTO application_data
           (application_id, brand_name, class_type, abv, net_contents, bottler, country_of_origin, government_warning)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [app.id, ad.brandName, ad.classType, ad.abv, ad.netContents, ad.bottler, ad.countryOfOrigin, ad.governmentWarning]
      )

      for (const [i, img] of app.images.entries()) {
        const imgRes = await client.query(
          `INSERT INTO application_images (application_id, position, base64, mime_type, side, raw_ocr_text)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
          [app.id, i, img.base64, img.mimeType, img.side ?? null, img.rawOcrText ?? null]
        )
        if (i === 0 && app.ocrData) {
          const payload = {
            extracted: app.ocrData.extracted,
            confidence: app.ocrData.confidence,
            boundingBoxes: app.ocrData.boundingBoxes,
          }
          await client.query(
            `INSERT INTO ocr_data (application_image_id, data, analyzed_at) VALUES ($1,$2,$3)`,
            [imgRes.rows[0].id, JSON.stringify(payload), app.ocrData.analyzedAt]
          )
        }
      }

      await client.query("COMMIT")
      console.log("seeded", app.id)
    } catch (e) {
      await client.query("ROLLBACK")
      throw e
    } finally {
      client.release()
    }
  }

  await pool.end()
  console.log("done")
}

seed().catch((e) => { console.error(e); process.exit(1) })
