import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests for server-side domain logic (financial rules, idempotency, authorization), and screens rendered to static
// markup. Next compiles JSX itself (tsconfig `jsx: preserve`); tests use React's automatic runtime, as in apps/admin.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) }
  },
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // A file's first test pays for importing the mock services; under the merge script's full parallel run that alone
    // passed vitest's 5 s default (retention, payments, quests, helperMiddleware …). 30 s matches the per-test overrides.
    testTimeout: 30_000
  }
});
