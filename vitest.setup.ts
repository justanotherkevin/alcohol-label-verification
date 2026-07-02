import path from "path"

try {
  process.loadEnvFile(path.resolve(__dirname, ".env.development.local"))
} catch {
  // no local env file (e.g. CI provides DATABASE_URL directly)
}
