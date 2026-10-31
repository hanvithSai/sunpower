/**
 * Vitest configuration. Unit tests cover the pure business rules in src/lib
 * (GST, subsidy, warranty, state machines); integration tests spin up an
 * in-memory MongoDB replica set. Path aliases (@/...) come from tsconfig.
 */
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 60_000,
  },
});
