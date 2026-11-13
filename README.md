# browser-assistant

![node version](https://img.shields.io/badge/node-%3E%3D22-blue)
![license](https://img.shields.io/github/license/alfredosalzillo/browser-assistant)

`browser-assistant` is a modular library to build **agentic assistants in the browser** on top of the
built-in [`LanguageModel` (Prompt API)](https://developer.chrome.com/docs/ai/prompt-api).

You give an assistant session a list of JavaScript functions (tools), each with a description and a
JSON Schema of its arguments. The session asks the on-device model to answer **only** with JSON
instructions describing which functions to call to reach the user's goal, runs them, sends the results
back to the model and repeats until the goal is reached.

## Features

- Multiple independent assistant sessions, each with its own tools, instructions and history.
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
npm install browser-assistant
```

## Usage

```ts
import { createAssistantSession, defineTool } from "browser-assistant";

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

const session = await createAssistantSession({
  tools: [addTodo, listTodos],
  instructions: "You manage the user's todo list.",
  onBeforeCall: (call) => confirm(`Run ${call.name}?`),
  onStep: (step) => console.log(step),
});

const result = await session.run("Add milk and bread to my list");

console.log(result.status); // "completed" | "max-steps"
console.log(result.message); // final message of the assistant
console.log(result.steps); // every model response with the executed calls

session.destroy();
```

### Multiple sessions

Every call to `createAssistantSession` creates an independent `LanguageModel` session:

```ts
const todoAssistant = await createAssistantSession({ tools: todoTools });
const pageAssistant = await createAssistantSession({ tools: pageTools });
```

### Availability

```ts
import { availability, isSupported } from "browser-assistant/availability";

if (!isSupported()) {
  // the browser has no built-in LanguageModel
}

const status = await availability(); // "unavailable" | "downloadable" | "downloading" | "available"
```

Download progress can be followed with the `monitor` option of `createAssistantSession`.

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

### `createAssistantSession(options)`

| Option                 | Type                                          | Default                    | Description                                               |
| ---------------------- | --------------------------------------------- | -------------------------- | --------------------------------------------------------- |
| `tools`                | `Tool[]`                                      | `[]`                       | Functions the assistant can call. Names must be unique.   |
| `instructions`         | `string`                                      | `undefined`                | Extra instructions appended to the system prompt.         |
| `maxSteps`             | `number`                                      | `10`                       | Maximum model responses per run.                          |
| `maxRetries`           | `number`                                      | `1`                        | Retries when the model answers with invalid JSON.         |
| `onBeforeCall`         | `(call, tool) => boolean \| Promise<boolean>` | `undefined`                | Approve or reject a call before it runs.                  |
| `onStep`               | `(step) => void`                              | `undefined`                | Called after every completed step.                        |
| `onToolCall`           | `(call) => void`                              | `undefined`                | Called before a tool runs.                                |
| `onToolResult`         | `(result) => void`                            | `undefined`                | Called after a tool runs.                                 |
| `monitor`              | `(monitor) => void`                           | `undefined`                | Forwarded to `LanguageModel.create` (download progress).  |
| `signal`               | `AbortSignal`                                 | `undefined`                | Aborts the creation of the `LanguageModel` session.       |
| `languageModelOptions` | `LanguageModelCreateOptions`                  | `undefined`                | Extra options forwarded to `LanguageModel.create`.        |
| `languageModel`        | `LanguageModelStatic`                         | `globalThis.LanguageModel` | Custom `LanguageModel` implementation (useful for tests). |

Returns an `AssistantSession`:

- `id`: unique id of the session,
- `tools`: the tools of the session,
- `history`: all the steps of all the runs,
- `run(goal, { signal?, maxSteps? })`: runs the agentic loop and resolves to `{ status, message, steps }`,
- `destroy()`: destroys the underlying `LanguageModel` session.

`run` rejects with an `AssistantResponseError` when the model keeps answering with invalid JSON after
`maxRetries` retries, and with the abort reason when the run `signal` is aborted.

### Modules

| Import                            | Content                                                                                |
| --------------------------------- | -------------------------------------------------------------------------------------- |
| `browser-assistant`               | Everything below.                                                                      |
| `browser-assistant/session`       | `createAssistantSession`, `AssistantResponseError`.                                    |
| `browser-assistant/tools`         | `defineTool`, `assertValidTools`.                                                      |
| `browser-assistant/protocol`      | `buildInstructions`, `buildResponseSchema`, `parseResponse` and the prompt formatters. |
| `browser-assistant/schema`        | `validateSchema` (JSON Schema subset validator).                                       |
| `browser-assistant/availability`  | `isSupported`, `availability`.                                                         |
| `browser-assistant/languageModel` | `getLanguageModel` and the `LanguageModel` types.                                      |
| `browser-assistant/types`         | Public types.                                                                          |

## Example

A React todo app driven by multiple assistant sessions lives in [`example/`](./example):

```bash
npm install
npm run example
```

Open the printed URL in a browser that supports the Prompt API.

## Development

```bash
npm install
npm run build
npm test
npm run lint
```

To test GitHub workflows locally, you can use [`act`](https://nektosact.com/).

## License

MIT
