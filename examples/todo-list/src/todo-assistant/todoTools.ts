import { type AnyTool, defineTool } from "@alfredo.salzillo/browser-assistant";
import type { TodoStore } from "../todoStore";

const idParameter = {
  type: "integer",
  description: "The id of the todo, read it with listTodos.",
} as const;

/**
 * createTodoTools returns the functions the assistants can call to manage the todo list.
 */
export const createTodoTools = (store: TodoStore): AnyTool[] => [
  defineTool({
    name: "listTodos",
    description: "Return all the todos with their id, title and done state.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    execute: () => store.getSnapshot(),
  }),
  defineTool<{ title: string }>({
    name: "addTodo",
    description: "Add a new todo to the list and return it.",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          minLength: 1,
          description: "The title of the todo.",
        },
      },
      required: ["title"],
      additionalProperties: false,
    },
    execute: ({ title }) => store.add(title),
  }),
  defineTool<{ id: number; done?: boolean }>({
    name: "toggleTodo",
    description:
      "Mark a todo as done or not done. Without done it inverts the current state.",
    parameters: {
      type: "object",
      properties: {
        id: idParameter,
        done: { type: "boolean", description: "The new done state." },
      },
      required: ["id"],
      additionalProperties: false,
    },
    execute: ({ id, done }) => store.toggle(id, done),
  }),
  defineTool<{ id: number }>({
    name: "removeTodo",
    description: "Remove a todo from the list.",
    parameters: {
      type: "object",
      properties: { id: idParameter },
      required: ["id"],
      additionalProperties: false,
    },
    execute: ({ id }) => store.remove(id),
  }),
  defineTool({
    name: "clearCompleted",
    description: "Remove all the done todos and return how many were removed.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    execute: () => store.clearCompleted(),
  }),
];
