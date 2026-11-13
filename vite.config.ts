import type viteModularLibrary from "modular-library/vite";
import dts from "unplugin-dts/vite";
import { defineConfig } from "vite";
import { createRequire } from "node:module";

// modular-library@0.0.5 ships a broken ESM chunk, load the CommonJS build until a fixed version is released
const modularLibrary: typeof viteModularLibrary = createRequire(
  import.meta.url,
)("modular-library/vite");

export default defineConfig({
  plugins: [
    modularLibrary(),
    dts({
      outDirs: ["dist"],
      include: ["src"],
      beforeWriteFile: (filePath, content) => ({
        filePath: filePath.replace(/([\\/])dist\1src\1/, "$1dist$1"),
        content,
      }),
    }),
  ],
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
