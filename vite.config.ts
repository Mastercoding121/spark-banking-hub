import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "src/server.ts" },
  },
  nitro: {
    preset: "vercel",
  },
  vite: {
    server: {
      host: "0.0.0.0",
      port: 5000,
      allowedHosts: true,
    },
    optimizeDeps: {
      exclude: ["#tanstack-router-entry", "#tanstack-start-entry", "tanstack-start-manifest:v"],
    },
    build: {
      rollupOptions: {
        external: ["#tanstack-router-entry", "#tanstack-start-entry", "tanstack-start-manifest:v"],
      },
    },
  },
});
