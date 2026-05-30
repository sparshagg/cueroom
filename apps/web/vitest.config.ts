import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react"
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
      "@cueroom/shared": new URL("../../packages/shared/src/index.ts", import.meta.url).pathname
    }
  },
  test: {
    environment: "jsdom"
  }
});
