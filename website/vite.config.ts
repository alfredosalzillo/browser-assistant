import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { cp, mkdir, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const websiteDir = import.meta.dirname;
const rootDir = resolve(websiteDir, "..");
const examplesDir = resolve(rootDir, "examples");
const librarySrc = resolve(rootDir, "src");

const copyExamplesToSite = (): Plugin => ({
  name: "copy-built-examples-to-site",
  apply: "build",
  async closeBundle() {
    const outputDir = resolve(websiteDir, "dist");
    await mkdir(outputDir, { recursive: true });
    const entries = await readdir(examplesDir, { withFileTypes: true });
    let copied = 0;

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      try {
        await cp(
          resolve(examplesDir, entry.name, "dist"),
          resolve(outputDir, entry.name),
          { recursive: true },
        );
        copied++;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
        throw error;
      }
    }

    await writeFile(resolve(outputDir, ".nojekyll"), "");
    console.info(`Copied ${copied} example build(s) into the website.`);
  },
});

export default defineConfig({
  root: websiteDir,
  base: "./",
  plugins: [react(), copyExamplesToSite()],
  resolve: {
    alias: [
      {
        find: /^@alfredo\.salzillo\/browser-assistant$/,
        replacement: `${librarySrc}/index.ts`,
      },
      {
        find: /^@alfredo\.salzillo\/browser-assistant\/(.*)$/,
        replacement: `${librarySrc}/$1.ts`,
      },
    ],
  },
  server: {
    fs: { allow: [rootDir] },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
