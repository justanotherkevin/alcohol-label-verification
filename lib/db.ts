import { Pool, types } from "pg"

// Return TIMESTAMPTZ as ISO strings to match app's string date types
types.setTypeParser(types.builtins.TIMESTAMPTZ, (v: string) => new Date(v).toISOString())

const rawConnectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL

// pg's ConnectionParameters re-derives `ssl` from the connection string's
// `sslmode` query param and overwrites any explicit `ssl` option passed to
// Pool (see pg/lib/connection-parameters.js). Since pg-connection-string
// treats sslmode=require/prefer/verify-ca as verify-full, we have to force
// sslmode=no-verify in the string itself to accept the provider's self-signed
// cert - passing `ssl: { rejectUnauthorized: false }` alongside connectionString
// has no effect.
function connectionStringWithSsl(connectionString: string | undefined) {
  if (!connectionString || connectionString.includes("localhost")) {
    return connectionString
  }
  const url = new URL(connectionString)
  url.searchParams.set("sslmode", "no-verify")
  return url.toString()
}

const connectionString = connectionStringWithSsl(rawConnectionString)

export const pool = new Pool({
  connectionString,
})
