import { resolve } from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// The editor's preview renders the real scene components from ../../renderer/src. Those files sit next to
// the renderer's own node_modules, so shared packages are deduplicated to this app's copies (one React, one Remotion).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@renderer": resolve(import.meta.dirname, "../../renderer/src") },
    dedupe: ["react", "react-dom", "remotion", "@remotion/google-fonts", "@remotion/noise", "three", "@react-three/fiber"],
  },
  server: { fs: { allow: [resolve(import.meta.dirname, "../..")] } },
  build: {
    target: "es2022",
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        app: resolve(import.meta.dirname, "app/index.html"),
        privacy: resolve(import.meta.dirname, "privacy/index.html"),
      },
    },
  },
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});
