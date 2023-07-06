import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { markdownProcessor } from "./src/utils/markdown-processor";
import { noScript } from "./src/no-script";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [noScript, react(), markdownProcessor],
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes("node_modules")) {
            return "vendor";
          }
        
          if (id.includes(".md")) {
            return "commands";
          }
        }
      },
    },
  }
});
