import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    // Ensure output is under client/dist for Vercel static build
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    minify: "esbuild",
    cssCodeSplit: true,
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 1000, // 1MB threshold
    rollupOptions: {
      output: {
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: ({ name }) => {
          const ext = (name ?? "").split(".").pop();
          return `assets/[name]-[hash].${ext}`;
        },
        // Split heavy vendor libraries into separate chunks
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("react") || id.includes("react-dom") || id.includes("react-router-dom")) {
              return "react-vendor";
            }
            if (id.includes("@tanstack/react-query")) {
              return "query";
            }
            if (id.includes("recharts")) {
              return "charting";
            }
            if (id.includes("leaflet") || id.includes("react-leaflet")) {
              return "maps";
            }
            if (id.includes("lucide-react")) {
              return "icons";
            }
            if (id.includes("@radix-ui")) {
              return "radix";
            }
            if (id.includes("@twilio/voice-sdk") || id.includes("twilio")) {
              return "twilio";
            }
            return "vendor";
          }
        },
      },
      treeshake: true,
    },
  },
});
