import path from "path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "app/**/*.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
    // Multiple files share the same Postgres instance and call
    // __resetQueueForTests(); running files in parallel races DELETE/INSERT
    // against the same tables, so force sequential execution.
    fileParallelism: false,
  },
})
