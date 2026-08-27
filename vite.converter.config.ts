import { copyFileSync, existsSync, unlinkSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "converter-index-entry",
      closeBundle() {
        const source = "converter-dist/converter.html";
        const target = "converter-dist/index.html";
        if (existsSync(source)) {
          copyFileSync(source, target);
          unlinkSync(source);
        }
      },
    },
  ],
  build: {
    outDir: "converter-dist",
    emptyOutDir: true,
    rollupOptions: {
      input: "converter.html",
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          pdf: ["pdfjs-dist"],
          docx: ["docx"],
        },
      },
    },
  },
});