import { Pool, types } from "pg"

// Return TIMESTAMPTZ as ISO strings to match app's string date types
types.setTypeParser(types.builtins.TIMESTAMPTZ, (v: string) => new Date(v).toISOString())

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})
