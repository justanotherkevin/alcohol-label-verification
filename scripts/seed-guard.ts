// Refuses to run seed scripts against a non-local database unless the caller
// explicitly opts in, so a stray env-file swap can't wipe/reseed production.
export function assertSeedTargetAllowed() {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? ""
  const isLocal = url.includes("localhost") || url.includes("127.0.0.1")

  if (!isLocal && process.env.SEED_ALLOW_REMOTE !== "true") {
    console.error(
      `Refusing to seed a non-local database:\n  ${url}\n` +
        "Set SEED_ALLOW_REMOTE=true to confirm you intend to seed this remote database.",
    )
    process.exit(1)
  }
}
