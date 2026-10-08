import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests for server-side domain logic (financial rules, idempotency, authorization), and screens rendered to
// static markup (list states). Next compiles JSX itself (tsconfig `jsx: preserve`); tests use React's automatic runtime.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) }
  },
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"]
  }
});
