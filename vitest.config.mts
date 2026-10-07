import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // server-only throws outside the React server runtime; tests import server modules directly
      "server-only": fileURLToPath(new URL("./src/server/__tests__/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts", "src/server/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/lib/types.ts", "src/server/__tests__/**"],
    },
  },
});
