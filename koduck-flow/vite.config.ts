import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "common/render/manager": fileURLToPath(
        new URL("./src/common/render/render-manager", import.meta.url)
      ),
    },
  },
});
