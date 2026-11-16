# browser-assistant

![npm version](https://img.shields.io/npm/v/@alfredo.salzillo/browser-assistant)
![node version](https://img.shields.io/badge/node-%3E%3D22-blue)
![license](https://img.shields.io/github/license/alfredosalzillo/browser-assistant)

`browser-assistant` is a modular library to build **agentic assistants in the browser** on top of the
built-in [`LanguageModel` (Prompt API)](https://developer.chrome.com/docs/ai/prompt-api).

You give an assistant session a list of JavaScript functions (tools), each with a description and a
JSON Schema of its arguments. The session asks the on-device model to answer **only** with JSON
instructions describing which functions to call to reach the user's goal, runs them, sends the results
back to the model and repeats until the goal is reached.

## Features

- Multiple independent assistants, each with its own instructions and history, created with
  `Assistant.createSession` and listed with `Assistant.listSessions`.
- Sessions survive a page refresh: they are stored in a configurable async storage (`LocalStorage` by
  default, `InMemoryStorage` for non persistent sessions) and restored lazily, on the first interaction.
- Tools described with a name, a description and a JSON Schema for the arguments.
- Model output constrained with `responseConstraint` (JSON Schema) **and** validated by the library, with
  automatic retry on malformed answers.
- Agentic loop: call → execute → feed results → repeat, bounded by `maxSteps` (default `10`).
- Tool errors and invalid arguments are fed back to the model so it can recover.
- Optional `onBeforeCall` hook to let a human approve or reject each call.
- Progress callbacks (`onStep`, `onToolCall`, `onToolResult`) and a full step log in the run result.
- Modular, tree-shakeable ES modules (built with [`modular-library`](https://github.com/alfredosalzillo/modular-library)).

## Requirements

- A browser exposing the built-in `LanguageModel` global (e.g. Chrome with the Prompt API enabled).
- Node.js `22` or newer to build the project.

## Installation

```bash
npm install @alfredo.salzillo/browser-assistant
```

## Usage

```ts
import {
  Assistant,
  defineTool,
  LocalStorage,
} from "@alfredo.salzillo/browser-assistant";

const todos: string[] = [];

const addTodo = defineTool<{ title: string }>({
  name: "addTodo",
  description: "Add a new todo item to the list.",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "The title of the todo." },
    },
    required: ["title"],
    additionalProperties: false,
  },
  execute: ({ title }) => {
    todos.push(title);
    return { id: todos.length - 1, title };
  },
});

const listTodos = defineTool({
  name: "listTodos",
  description: "Return all the todo items.",
  parameters: { type: "object", properties: {}, additionalProperties: false },
  execute: () => todos,
});

// Configure the assistants once, before any other `Assistant` method.
Assistant.config({
  storage: LocalStorage, // the default, sessions survive a page refresh
  tools: [addTodo, listTodos],
});

const assistant = await Assistant.createSession({
  instructions: "You manage the user's todo list.",
  onBeforeCall: (call) => confirm(`Run ${call.name}?`),
  onStep: (step) => console.log(step),
});

const result = await assistant.run("Add milk and bread to my list");

console.log(result.status); // "completed" | "max-steps"
console.log(result.message); // final message of the assistant
console.log(result.steps); // every model response with the executed calls

assistant.destroy();
```

### Multiple sessions

Every call to `Assistant.createSession` creates an independent assistant backed by its own `LanguageModel`
session. `Assistant.listSessions()` is an async iterator over the live assistants (created and not destroyed),
in creation order:

```ts
// `Assistant.config({ tools: [...todoTools, ...pageTools] })` was called before
const todoAssistant = await Assistant.createSession({
  toolNames: todoTools.map((tool) => tool.name),
});
const pageAssistant = await Assistant.createSession({
  toolNames: pageTools.map((tool) => tool.name),
});

for await (const assistant of Assistant.listSessions()) {
  console.log(assistant.id); // todoAssistant, then pageAssistant
}

todoAssistant.destroy(); // no longer listed
```

### Configuration and persistence

`Assistant.config` sets the global configuration and **must be called before** any other `Assistant` method
(`createSession`, `listSessions`): calling it afterwards throws an `Error`. The tools are registered in the
config (a session selects a subset of them with `toolNames`), and so is the storage:

```ts
import {
  Assistant,
  InMemoryStorage,
  LocalStorage,
} from "@alfredo.salzillo/browser-assistant";

Assistant.config({ storage: LocalStorage, tools }); // default storage, persistent
Assistant.config({ storage: InMemoryStorage, tools }); // lost on reload
Assistant.config({ storage: new MyRemoteStorage(), tools }); // any `AssistantStorage`
```

A storage implements the async `AssistantStorage` interface (`getItem`, `setItem`, `removeItem`, all returning
promises), so a remote storage can be added in the future. `LocalStorage` falls back to memory when
`localStorage` is not available.

The first `createSession` or `listSessions` call hydrates the stored sessions. A restored session recreates its
`LanguageModel` session only at its first `run`, with its saved history. Tools still present in the config are
restored; the tools that no longer exist are sent to the session, once, as removed (and recorded in its
`history`). Pass `languageModel` / `monitor` to `run` to control how a restored session creates its model.

> **Breaking change (0.1.0)**: `tools` is no longer an option of `Assistant.createSession`, register them with
> `Assistant.config({ tools })` and select them with `toolNames`.

### Availability

```ts
import {
  availability,
  isSupported,
} from "@alfredo.salzillo/browser-assistant/availability";

if (!isSupported()) {
  // the browser has no built-in LanguageModel
}

const status = await availability(); // "unavailable" | "downloadable" | "downloading" | "available"
```

Download progress can be followed with the `monitor` option of `Assistant.createSession`.

## Response protocol

The session initializes the `LanguageModel` with system instructions that force it to answer only with
one of these JSON objects:

```json
{
  "type": "calls",
  "reasoning": "short explanation of why these calls reach the goal",
  "calls": [{ "name": "addTodo", "arguments": { "title": "milk" } }]
}
```

```json
{ "type": "final", "message": "I added milk to your list." }
```

After each `calls` answer the library executes the calls in order and sends the results back:

```json
[
  {
    "name": "addTodo",
    "arguments": { "title": "milk" },
    "status": "success",
    "result": { "id": 0 }
  },
  {
    "name": "removeTodo",
    "arguments": { "id": 9 },
    "status": "error",
    "error": "Todo 9 not found"
  }
]
```

A call `status` is `success`, `error` (the tool threw or the arguments are invalid) or `rejected`
(`onBeforeCall` returned `false`).

## API

### `Assistant.createSession(options)`

Creates a new assistant and resolves to an `Assistant` instance (the constructor is private).

| Option                 | Type                                          | Default                    | Description                                                 |
| ---------------------- | --------------------------------------------- | -------------------------- | ----------------------------------------------------------- |
| `toolNames`            | `string[]`                                    | all the configured tools   | Names of the `Assistant.config` tools the session can call. |
| `instructions`         | `string`                                      | `undefined`                | Extra instructions appended to the system prompt.           |
| `maxSteps`             | `number`                                      | `10`                       | Maximum model responses per run.                            |
| `maxRetries`           | `number`                                      | `1`                        | Retries when the model answers with invalid JSON.           |
| `onBeforeCall`         | `(call, tool) => boolean \| Promise<boolean>` | `undefined`                | Approve or reject a call before it runs.                    |
| `onStep`               | `(step) => void`                              | `undefined`                | Called after every completed step.                          |
| `onToolCall`           | `(call) => void`                              | `undefined`                | Called before a tool runs.                                  |
| `onToolResult`         | `(result) => void`                            | `undefined`                | Called after a tool runs.                                   |
| `monitor`              | `(monitor) => void`                           | `undefined`                | Forwarded to `LanguageModel.create` (download progress).    |
| `signal`               | `AbortSignal`                                 | `undefined`                | Aborts the creation of the `LanguageModel` session.         |
| `languageModelOptions` | `LanguageModelCreateOptions`                  | `undefined`                | Extra options forwarded to `LanguageModel.create`.          |
| `languageModel`        | `LanguageModelStatic`                         | `globalThis.LanguageModel` | Custom `LanguageModel` implementation (useful for tests).   |

Returns a `Promise<Assistant>`. An `Assistant` has:

- `id`: unique id of the assistant,
- `tools`: the tools of the assistant,
- `history`: all the steps of all the runs,
- `run(goal, { signal?, maxSteps?, languageModel?, monitor? })`: runs the agentic loop and resolves to `{ status, message, steps }`,
- `destroy()`: destroys the underlying `LanguageModel` session and removes the assistant from
  `Assistant.listSessions()` and from the storage.

`run` rejects with an `AssistantResponseError` when the model keeps answering with invalid JSON after
`maxRetries` retries, and with the abort reason when the run `signal` is aborted.

### `Assistant.config(config)`

| Option    | Type                                  | Default        | Description                                        |
| --------- | ------------------------------------- | -------------- | -------------------------------------------------- |
| `storage` | `AssistantStorage` or a storage class | `LocalStorage` | Where the sessions are stored (all methods async). |
| `tools`   | `Tool[]`                              | `[]`           | Functions the assistants can call. Unique names.   |

Throws if called after `createSession` or `listSessions`.

### `Assistant.listSessions()`

Returns an `AsyncIterableIterator<Assistant>` yielding the live assistants (created and not
destroyed) in creation order. Assistants destroyed while iterating are skipped.

### Modules

| Import                                              | Content                                                                                |
| --------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `@alfredo.salzillo/browser-assistant`               | Everything below.                                                                      |
| `@alfredo.salzillo/browser-assistant/assistant`     | `Assistant`, `AssistantResponseError`.                                                 |
| `@alfredo.salzillo/browser-assistant/storage`       | `AssistantStorage`, `LocalStorage`, `InMemoryStorage`.                                 |
| `@alfredo.salzillo/browser-assistant/tools`         | `defineTool`, `assertValidTools`.                                                      |
| `@alfredo.salzillo/browser-assistant/protocol`      | `buildInstructions`, `buildResponseSchema`, `parseResponse` and the prompt formatters. |
| `@alfredo.salzillo/browser-assistant/schema`        | `validateSchema` (JSON Schema subset validator).                                       |
| `@alfredo.salzillo/browser-assistant/availability`  | `isSupported`, `availability`.                                                         |
| `@alfredo.salzillo/browser-assistant/languageModel` | `getLanguageModel` and the `LanguageModel` types.                                      |
| `@alfredo.salzillo/browser-assistant/types`         | Public types.                                                                          |

## Website

The documentation website is live at
[alfredosalzillo.github.io/browser-assistant](https://alfredosalzillo.github.io/browser-assistant/).
It is a single React + [MUI](https://mui.com/material-ui/) page in [`website`](./website) that explains
what the library is and how to use it, links every example and contains a small **theme assistant**:
an `Assistant` with `getTheme`, `setPrimaryColor`, `setSecondaryColor`, `setMode` and `resetTheme`
tools that changes the colours of the website itself. Like the examples, it imports
`@alfredo.salzillo/browser-assistant` from `src/`.

```bash
npm run website:dev # starts the website
npm run pages:build # builds every example, then the website, in website/dist
```

`npm run pages:build` copies each `examples/<name>/dist` into `website/dist/<name>`, so the website
and the examples are deployed together on GitHub Pages. The site is rebuilt and deployed
automatically on every push to `main`; configure the repository's Pages source as **GitHub Actions**
to enable deployment.

## Examples

Live demos are published on [GitHub Pages](https://alfredosalzillo.github.io/browser-assistant/)
together with the website, which links every example. Each example also has its own link below.

The examples live in [`examples/`](./examples). Each one is an independent package with its own
`package.json` and dependencies, so the library itself never depends on them. They are
[npm workspaces](https://docs.npmjs.com/cli/using-npm/workspaces) of the root package: a single
`npm install` in the root installs them, and they import `@alfredo.salzillo/browser-assistant` from `src/` through a Vite
alias, so no library build is needed.

```bash
npm install
npm run dev --workspace examples/todo-list # or: npm run example:todo-list
npm run examples:build # builds every example (not the website)
```

### Todo list

A React + [MUI](https://mui.com/material-ui/) todo app driven by multiple assistant sessions, in
[`examples/todo-list`](./examples/todo-list), with a [live demo](https://alfredosalzillo.github.io/browser-assistant/todo-list/).
Open the printed URL. The example shows:

- a full width todo list in the center, changed both by the UI and by the assistants,
- an agentic chat column on the right (the `AssistantPanel` component, which owns the presets and the
  sessions): the **+** button starts a new session from one of two presets
  (a **Todo manager** with all the tools and a **Read-only reviewer** with only `listTodos`) and the
  history button lists the sessions to switch between them, each one keeping its own conversation,
- every step of a run (reasoning and calls with their status), with the prompt fixed at the bottom,
- an "Ask approval" toggle wired to `onBeforeCall`,
- a light/dark theme switch,
- a notice in the assistant panel when the browser does not support the built-in `LanguageModel`.

The example requires a browser with the built-in Prompt API enabled (for example Chrome with
`chrome://flags/#prompt-api-for-gemini-nano`). When the `LanguageModel` is missing or its
availability is `unavailable`, the assistant panel shows a message asking to use a supporting browser.

Build a static version with `npm run build --workspace examples/todo-list` (output in
`examples/todo-list/dist`).

### Adding an example

Create a new `examples/<name>` directory with its own `package.json` (with `dev`, `build` and
`typecheck` scripts), a `vite.config.ts` aliasing `@alfredo.salzillo/browser-assistant` to `../../src` and a
`tsconfig.json` with the matching `paths`. Run `npm install` in the root to link it. The website
lists it automatically (reading its `package.json` `description`) and links it at `./<name>/`; the
continuous delivery workflow builds and publishes every example that has a `dist` directory under
`https://alfredosalzillo.github.io/browser-assistant/<name>/`. Still add the example to this README
with its GitHub Pages link.

## Development

```bash
npm install
npm run build
npm test
npm run lint
npm run typecheck
```

To test GitHub workflows locally, you can use [`act`](https://nektosact.com/).

## License

MIT
