import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // 全局配置
    globals: true,
    environment: "jsdom",

    // 设置文件
    setupFiles: ["./test/setup.ts"],

    // 测试文件匹配
    include: ["src/**/*.{test,spec}.{js,ts,jsx,tsx}", "test/**/*.{test,spec}.{js,ts,jsx,tsx}"],
    exclude: ["node_modules", "dist", "coverage", "test/e2e/**"],

    // 报告器配置
    reporters: process.env.CI ? ["default", "json"] : ["verbose"],

    // 覆盖率配置
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
        "src/components/FlowDemo/",
        "src/components/hooks/",
        "src/components/Editor/",
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

    // 超时配置
    testTimeout: 60000,
    hookTimeout: 10000,

    // 其他配置
    logHeapUsage: true,
    passWithNoTests: true,
  },
});
