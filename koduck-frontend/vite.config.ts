import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
      '@koduck-flow/common': path.resolve(__dirname, '../koduck-flow/src/common'),
      '@koduck-flow/components': path.resolve(__dirname, '../koduck-flow/src/components'),
      '@koduck-flow': path.resolve(__dirname, '../koduck-flow/src/components/flow-entity'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }

          if (
            id.includes("react-router") ||
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("/scheduler/")
          ) {
            return "framework";
          }

          if (id.includes("react-markdown") || id.includes("remark-gfm") || id.includes("/remark-")) {
            return "markdown";
          }

          if (id.includes("recharts") || id.includes("d3-")) {
            return "charts";
          }

          if (id.includes("@mui/") || id.includes("@emotion/")) {
            return "mui";
          }

          if (id.includes("@radix-ui/")) {
            return "radix";
          }

          return "vendor";
        },
      },
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
