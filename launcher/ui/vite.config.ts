import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The launcher bundles to static files the Tauri shell embeds (frontendDist
// points at ../ui/dist from launcher/src-tauri/tauri.conf.json).
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "chrome110",
  },
});
