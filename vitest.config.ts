import { defineConfig } from "vitest/config";

const coverageProvider = (process.env.VITEST_COVERAGE_PROVIDER ?? "v8") as "v8" | "istanbul";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/unit/setup.ts"],
    include: ["tests/unit/**/*.test.ts"],
    exclude: ["tests/e2e/**"],
    coverage: {
      provider: coverageProvider,
      reporter: ["text", "text-summary", "html", "lcov"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/dev/**",
        "src/import-meta-env.d.ts",
        "src/background/e2e.ts",
        "src/background/index.ts",
        "src/background/context-menus.ts",
        "src/background/types.ts",
        "src/content-scripts/**",
        "src/surfaces/**/main.ts",
        "src/surfaces/**/forced-state.ts",
        "src/surfaces/options/page.ts",
        "src/surfaces/popup/page.ts",
        "src/surfaces/options/rules-types.ts",
      ],
      thresholds: {
        statements: 85,
        branches: 80,
        functions: 90,
        lines: 85,
      },
      reportOnFailure: true,
      cleanOnRerun: true,
    },
  },
});
