import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      "packages/*",
      "apps/*",
      "services/*",
      "workers/*"
    ],

    environment: "node",

    globals: false,

    clearMocks: true,
    mockReset: true,
    restoreMocks: true,

    passWithNoTests: true,

    testTimeout: 15_000,
    hookTimeout: 15_000,

    reporters: ["default"],

    coverage: {
      provider: "v8",
      reporter: [
        "text",
        "text-summary",
        "html",
        "lcov"
      ],
      reportsDirectory: "./coverage",
      exclude: [
        "**/dist/**",
        "**/node_modules/**",
        "**/*.d.ts",
        "**/*.config.*",
        "**/tests/**",
        "**/*.test.*",
        "**/*.spec.*"
      ]
    }
  }
});
