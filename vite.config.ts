import modularLibrary from "modular-library/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [modularLibrary()],
  build: {
    target: "es2022",
    lib: {
      entry: ["src/**/*.ts"],
      formats: ["es"],
      fileName: (_format, entryName) => `${entryName}.js`,
    },
    rolldownOptions: {
      output: {
        chunkFileNames: "chunks/[name].js",
      },
    },
  },
});
