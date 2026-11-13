import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { resolve } from "node:path";

const src = resolve(import.meta.dirname, "../../src");

export default defineConfig({
  root: import.meta.dirname,
  base: "./",
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^@alfredo\.salzillo\/browser-assistant$/,
        replacement: `${src}/index.ts`,
      },
      {
        find: /^@alfredo\.salzillo\/browser-assistant\/(.*)$/,
        replacement: `${src}/$1.ts`,
      },
    ],
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
