import { pool } from "../lib/db"
import { SEED_RESOLUTIONS } from "../lib/queue/seed-resolutions"
import { assertSeedTargetAllowed } from "./seed-guard"

async function seedResolutions() {
  assertSeedTargetAllowed()

  const client = await pool.connect()
  try {
    await client.query("BEGIN")

    // Revert demo applications currently resolved back into the queue, then
    // clear their resolutions so this run fully replaces prior demo data.
    await client.query(
      `UPDATE applications SET status = 'analyzed' WHERE status = 'resolved' AND id LIKE 'demo-%'`,
    )
    await client.query(`DELETE FROM resolutions WHERE application_id LIKE 'demo-%'`)

    for (const { applicationId, resolution } of SEED_RESOLUTIONS) {
      const appRes = await client.query(`SELECT id FROM applications WHERE id = $1`, [applicationId])
      if (appRes.rows.length === 0) {
        throw new Error(`SEED_RESOLUTIONS references unknown application id: ${applicationId}`)
      }

      await client.query(
        `INSERT INTO resolutions
           (application_id, decision, overrides, rejected_fields, note, resolved_at, specialist_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          applicationId,
          resolution.decision,
          JSON.stringify(resolution.overrides),
          JSON.stringify(resolution.rejectedFields),
          resolution.note,
          resolution.resolvedAt,
          resolution.specialistId ?? null,
        ]
      )
      await client.query(`UPDATE applications SET status = 'resolved' WHERE id = $1`, [applicationId])
      console.log("resolved", applicationId)
    }

    await client.query("COMMIT")
  } catch (e) {
    await client.query("ROLLBACK")
    throw e
  } finally {
    client.release()
  }

  await pool.end()
  console.log("done")
}

seedResolutions().catch((e) => {
  console.error(e)
  process.exit(1)
})
