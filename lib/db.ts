import { Pool, types } from "pg"

// Return TIMESTAMPTZ as ISO strings to match app's string date types
types.setTypeParser(types.builtins.TIMESTAMPTZ, (v: string) => new Date(v).toISOString())

const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL

export const pool = new Pool({
  connectionString,
  ssl: connectionString?.includes("localhost")
    ? false
    : { rejectUnauthorized: false },
})
