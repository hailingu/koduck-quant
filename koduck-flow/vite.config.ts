import { fileURLToPath, URL } from "node:url";

import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";

const libraryEntries = {
  index: fileURLToPath(new URL("./src/index.ts", import.meta.url)),
  components: fileURLToPath(new URL("./src/components/index.ts", import.meta.url)),
  "components/flow-entity": fileURLToPath(
    new URL("./src/components/flow-entity/index.ts", import.meta.url)
  ),
  "components/provider": fileURLToPath(
    new URL("./src/components/provider/index.ts", import.meta.url)
  ),
  "common/render/manager": fileURLToPath(
    new URL("./src/common/render/render-manager/index.ts", import.meta.url)
  ),
};

// https://vite.dev/config/
export default defineConfig({
  plugins: react() as unknown as PluginOption[],
  build: {
    copyPublicDir: false,
    lib: {
      entry: libraryEntries,
      formats: ["es"],
      fileName: (_format, entryName) => `${entryName}.js`,
    },
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime"],
      output: {
        manualChunks(id) {
          if (id.includes("/src/components/demo/")) {
            return "flow-demo";
          }
          if (id.includes("/src/components/testing/")) {
            return "e2e-harness";
          }
          return undefined;
        },
      },
    },
  },
  resolve: {
    alias: {
      "common/render/manager": fileURLToPath(
        new URL("./src/common/render/render-manager", import.meta.url)
      ),
      "./loader/sources": fileURLToPath(
        new URL("./src/common/config/loader/browser/sources.ts", import.meta.url)
      ),
      "./sources": fileURLToPath(
        new URL("./src/common/config/loader/browser/sources.ts", import.meta.url)
      ),
      "./loader/hot-reload": fileURLToPath(
        new URL("./src/common/config/loader/browser/hot-reload.ts", import.meta.url)
      ),
      "./loader/http-server": fileURLToPath(
        new URL("./src/common/config/loader/browser/http-server.ts", import.meta.url)
      ),
    },
  },
});
