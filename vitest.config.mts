/**
 * Vitest configuration. Unit tests cover the pure business rules in src/lib
 * and server helpers (GST, subsidy, warranty, state machines, error
 * classification); integration flows run via scripts/check-*.ts. Path aliases
 * (@/...) are resolved natively from tsconfig by Vite.
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 60_000,
  },
});
