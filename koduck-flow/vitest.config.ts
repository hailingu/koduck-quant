import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Global configuration
    globals: true,
    environment: "jsdom",

    // Setup files
    setupFiles: ["./test/setup.ts"],

    // Test file matching
    include: ["src/**/*.{test,spec}.{js,ts,jsx,tsx}", "test/**/*.{test,spec}.{js,ts,jsx,tsx}"],
    exclude: ["node_modules", "dist", "coverage", "test/e2e/**"],

    // Reporter configuration
    reporters: process.env.CI ? ["default", "json"] : ["verbose"],

    // Coverage configuration
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      exclude: [
        "node_modules/",
        "dist/",
        "coverage/",
        "**/*.d.ts",
        "**/*.config.*",
        "**/test.d.ts",
        "**/setup.ts",
        "src/components/demo/FlowDemo/",
        "src/components/provider/hooks/",
        "src/components/editor/Editor/",
        "src/common/engine/",
        "src/common/render/webgpu-render.ts",
        "src/**/types.ts",
        "src/**/index.ts",
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },

    // Timeout configuration
    testTimeout: 60000,
    hookTimeout: 10000,

    // Other configuration
    logHeapUsage: true,
    passWithNoTests: true,
  },
});
