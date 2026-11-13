# AGENTS.md

This file provides context and instructions for AI coding agents working on this project.

## Project Overview

`@alfredo.salzillo/browser-assistant` (`browser-assistant`) is a modular browser library that builds
agentic assistants on top of the built-in `LanguageModel` (Prompt API). A session receives a list of tools (JavaScript functions with a description
and a JSON Schema of their arguments), forces the model to answer only with JSON instructions of the
functions to call, executes them and loops until the goal is reached.

## Setup Commands

-   Install dependencies: `npm install`
-   Build the project: `npm run build`
-   Run tests: `npm test`
-   Run lint checks: `npm run lint`
-   Run type checks (library, tests and examples): `npm run typecheck`
-   Run the todo list example UI: `npm run example:todo-list`
-   Build all the examples: `npm run examples:build`

## Project Structure

-   `src/`: library source. Every `src/**/*.ts` file is a public module (built by `modular-library/vite`)
    and must have a matching entry in the `package.json` `exports` map.
-   `test/`: Vitest unit tests. Tests never run a real model: use the mocked `LanguageModel` in `test/mocks`.
-   `examples/`: testable UIs, one npm workspace per directory (for example `examples/todo-list`). Each
    example has its own `package.json` with its own dependencies (never add them to the root
    `package.json`), and `dev`, `build` and `typecheck` scripts. Examples import
    `@alfredo.salzillo/browser-assistant` from `src/` through a Vite alias (and `paths` in their
    `tsconfig.json`), never from npm, so no library build is needed.
-   `examples/todo-list/`: React + MUI + Vite todo app. It requires a browser with the built-in Prompt API;
    unsupported browsers see a notice in the assistant panel.

## Technology Stack

-   **TypeScript**: Use TypeScript for all code changes. Follow the existing configuration in `tsconfig.json`.
-   **Vite** (library mode, ES modules only) with the **modular-library** plugin and **unplugin-dts**.
-   **Vitest** with v8 coverage for tests.
-   **Biome** for linting and formatting.
-   **npm workspaces** for the examples.
-   **React** and **MUI** (`@mui/material`, `@mui/icons-material`, Emotion) for the examples only (never a
    dependency of the library).
-   Keep this `AGENTS.md` technology stack section up to date whenever the project tech stack changes.

## Development Workflow

1.  **Keep changes minimal**: Implement the smallest safe change that resolves the issue.
2.  **No runtime dependencies**: The library must stay dependency free and browser only.
3.  **Build**: Before submitting, ensure the project compiles by running `npm run build`.
4.  **Validate**: Run relevant tests with `npm test` when behavior changes.
5.  **Code Style**: Follow the existing style and naming patterns in the codebase.
6.  **GitHub Workflows**: To test workflows locally, use [`act`](https://nektosact.com/).

## Temporary Files

-   **Temporary Directory**: Always place temporary files in the `.ai-tmp` directory.

## Commit Message Guidelines

When creating commits, use **Conventional Commits**.

### Format

```text
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

-   `feat`: A new feature (minor version update).
-   `fix`: A bug fix (patch version update).
-   `docs`: Documentation changes only.
-   `style`: Changes that do not affect the meaning of the code (white-space, formatting, etc).
-   `refactor`: A code change that neither fixes a bug nor adds a feature.
-   `perf`: A code change that improves performance.
-   `test`: Adding missing tests or correcting existing tests.
-   `build`: Changes that affect the build system or external dependencies.
-   `ci`: Changes to CI configuration files and scripts.
-   `chore`: Other changes that don't modify src or test files.

### Breaking Changes

Breaking changes must be indicated by a `!` after the type/scope or by including `BREAKING CHANGE:` in the footer.
