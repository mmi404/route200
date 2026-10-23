import path from "path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Mirrors tsconfig.json's own "paths" entry ("@/*": ["./*"], resolved
// relative to this file since tsconfig.json sets no baseUrl) so an import
// like "@/lib/types" resolves the same way under Vitest as it does under
// Next's own bundler.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: ["node_modules", ".next"],
  },
});
