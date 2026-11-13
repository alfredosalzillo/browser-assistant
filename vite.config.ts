import modularLibrary from "modular-library/vite";
import dts from "unplugin-dts/vite";
import { defineConfig } from "vite";

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
