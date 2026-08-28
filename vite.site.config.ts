import { defineConfig } from "vite";

export default defineConfig({
  root: "site",
  publicDir: "../public",
  build: {
    target: "es2022",
    outDir: "../dist/site",
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        index: "site/index.html",
        privacy: "site/privacy/index.html",
        terms: "site/terms/index.html"
      }
    }
  }
});
