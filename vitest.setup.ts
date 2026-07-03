import path from "path"

try {
  process.loadEnvFile(path.resolve(__dirname, ".env.test.local"))
} catch {
  // no local env file (e.g. CI provides DATABASE_URL directly)
}
