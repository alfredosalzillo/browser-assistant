import {
  Assistant,
  type AssistantOptions,
  InMemoryStorage,
} from "@alfredo.salzillo/browser-assistant";
import type { TodoStore } from "../todoStore";
import { createTodoTools } from "./todoTools";

export type TodoAssistantPreset = {
  id: string;
  label: string;
  instructions: string;
  toolNames: string[];
  suggestions: string[];
};

export const todoAssistantPresets: TodoAssistantPreset[] = [
  {
    id: "manager",
    label: "Todo manager",
    instructions:
      "You manage the todo list of the user. Read the list with listTodos before changing todos by id.",
    toolNames: [
      "listTodos",
      "addTodo",
      "toggleTodo",
      "removeTodo",
      "clearCompleted",
    ],
    suggestions: ["add milk and bread", "complete 1", "clear"],
  },
  {
    id: "reviewer",
    label: "Read-only reviewer",
    instructions:
      "You can only read the todo list. Summarize it and suggest priorities, never pretend to change it.",
    toolNames: ["listTodos"],
    suggestions: ["list"],
  },
];

export type CreateTodoAssistantOptions = Omit<
  AssistantOptions,
  "toolNames" | "instructions"
> & {
  store: TodoStore;
  preset: TodoAssistantPreset;
};

let configuredStore: TodoStore | undefined;

/**
 * configureTodoAssistant registers the tools of the store with `Assistant.config`. The config can
 * be set only once, before the first session is created. The todos are not persisted, so the
 * sessions are kept in memory too.
 */
const configureTodoAssistant = (store: TodoStore) => {
  if (configuredStore) {
    if (configuredStore !== store) {
      throw new Error("The todo assistant is already configured for a store");
    }
    return;
  }
  Assistant.config({ storage: InMemoryStorage, tools: createTodoTools(store) });
  configuredStore = store;
};

/**
 * createTodoAssistant creates a new assistant that manages the todos of the store, with the tools
 * and the instructions of the preset.
 */
export const createTodoAssistant = ({
  store,
  preset,
  ...options
}: CreateTodoAssistantOptions): Promise<Assistant> => {
  configureTodoAssistant(store);
  return Assistant.createSession({
    ...options,
    toolNames: preset.toolNames,
    instructions: preset.instructions,
  });
};
