import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const examplesDir = join(root, "examples");
const outputDir = join(root, "pages");
const directories = await readdir(examplesDir, { withFileTypes: true });
const examples = [];

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

for (const directory of directories.sort((left, right) =>
  left.name.localeCompare(right.name),
)) {
  if (!directory.isDirectory()) continue;

  const exampleDir = join(examplesDir, directory.name);
  const distDir = join(exampleDir, "dist");

  try {
    const packageJson = JSON.parse(
      await readFile(join(exampleDir, "package.json"), "utf8"),
    );
    await cp(distDir, join(outputDir, directory.name), { recursive: true });
    examples.push({
      directory: directory.name,
      name: packageJson.displayName ?? packageJson.name ?? directory.name,
      description: packageJson.description ?? "",
    });
  } catch (error) {
    if (error.code === "ENOENT") continue;
    throw error;
  }
}

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });

const links = examples
  .map(
    ({ directory, name, description }) => `
      <li>
        <a href="./${encodeURIComponent(directory)}/">${escapeHtml(name)}</a>
        <p>${escapeHtml(description)}</p>
      </li>`,
  )
  .join("\n");

await writeFile(
  join(outputDir, "index.html"),
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Browser Assistant examples</title>
    <style>
      body { color: #202124; font: 16px/1.5 system-ui, sans-serif; margin: 0 auto; max-width: 760px; padding: 48px 24px; }
      h1 { font-size: clamp(2rem, 6vw, 3rem); line-height: 1.1; }
      li { border-top: 1px solid #dadce0; list-style: none; padding: 20px 0; }
      ul { margin: 32px 0 0; padding: 0; }
      a { color: #1558d6; font-weight: 650; }
      p { color: #5f6368; margin: 8px 0 0; }
    </style>
  </head>
  <body>
    <main>
      <h1>Browser Assistant examples</h1>
      <p>Explore browser demos built with the built-in LanguageModel Prompt API.</p>
      <ul>${links || "<li>No examples are currently available.</li>"}
      </ul>
    </main>
  </body>
</html>
`,
);
await writeFile(join(outputDir, ".nojekyll"), "");

console.log(
  `Prepared ${examples.length} example(s) for GitHub Pages in ${outputDir}.`,
);
