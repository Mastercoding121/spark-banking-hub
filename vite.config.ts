import { defineConfig } from "@tanstack/react-start/config";
import viteTsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  server: {
    entry: "src/server.ts",
  },
  nitro: {
    preset: "vercel",
  },
  vite: {
    plugins: [viteTsConfigPaths()],
    server: {
      host: "0.0.0.0",
      port: 5000,
      allowedHosts: true,
    },
  },
});
