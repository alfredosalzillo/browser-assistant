import { AssistantResponseError, createAssistantSession } from "../src/session";
import { defineTool } from "../src/tools";
import type { AnyTool } from "../src/types";
import { createMockLanguageModel } from "./mocks/languageModel";

const createTodoTools = () => {
  const todos: { id: number; title: string }[] = [];
  const addTodo = defineTool<{ title: string }>({
    name: "addTodo",
    description: "Add a todo item",
    parameters: {
      type: "object",
      properties: { title: { type: "string" } },
      required: ["title"],
      additionalProperties: false,
    },
    execute: ({ title }) => {
      const todo = { id: todos.length + 1, title };
      todos.push(todo);
      return todo;
    },
  });
  const removeTodo = defineTool<{ id: number }>({
    name: "removeTodo",
    description: "Remove a todo item",
    parameters: {
      type: "object",
      properties: { id: { type: "integer" } },
      required: ["id"],
    },
    execute: ({ id }) => {
      throw new Error(`Todo ${id} not found`);
    },
  });
  return { todos, tools: [addTodo, removeTodo] as AnyTool[] };
};

const calls = (...items: [string, Record<string, unknown>][]) => ({
  type: "calls",
  reasoning: "reach the goal",
  calls: items.map(([name, args]) => ({ name, arguments: args })),
});
const final = (message: string) => ({ type: "final", message });

describe("createAssistantSession", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws when LanguageModel is not supported", async () => {
    await expect(createAssistantSession()).rejects.toThrow(
      "LanguageModel is not supported in this browser",
    );
  });

  it("throws on invalid tools", async () => {
    const { tools } = createTodoTools();
    await expect(
      createAssistantSession({
        tools: [...tools, tools[0]],
        languageModel: createMockLanguageModel(),
      }),
    ).rejects.toThrow("Duplicated tool name");
  });

  it("initializes the LanguageModel with the JSON instructions", async () => {
    const { tools } = createTodoTools();
    const languageModel = createMockLanguageModel();
    const monitor = vi.fn();
    vi.stubGlobal("LanguageModel", languageModel);
    await createAssistantSession({
      tools,
      instructions: "Manage todos",
      monitor,
      languageModelOptions: { temperature: 0.2 },
    });
    const [{ createOptions }] = languageModel.sessions;
    expect(createOptions.temperature).toBe(0.2);
    expect(createOptions.monitor).toBe(monitor);
    expect(createOptions.expectedOutputs).toEqual([
      { type: "text", languages: ["en"] },
    ]);
    expect(createOptions.initialPrompts).toHaveLength(1);
    expect(createOptions.initialPrompts?.[0].role).toBe("system");
    expect(createOptions.initialPrompts?.[0].content).toContain(
      "- addTodo: Add a todo item",
    );
    expect(createOptions.initialPrompts?.[0].content).toContain("Manage todos");
  });

  it("runs the agentic loop until the final answer", async () => {
    const { todos, tools } = createTodoTools();
    const languageModel = createMockLanguageModel([
      calls(["addTodo", { title: "milk" }], ["addTodo", { title: "bread" }]),
      final("Added milk and bread"),
    ]);
    const onStep = vi.fn();
    const onToolCall = vi.fn();
    const onToolResult = vi.fn();
    const session = await createAssistantSession({
      tools,
      languageModel,
      onStep,
      onToolCall,
      onToolResult,
    });

    const result = await session.run("add milk and bread");

    expect(result.status).toBe("completed");
    expect(result.message).toBe("Added milk and bread");
    expect(todos.map((todo) => todo.title)).toEqual(["milk", "bread"]);
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0].results).toEqual([
      {
        name: "addTodo",
        arguments: { title: "milk" },
        status: "success",
        result: { id: 1, title: "milk" },
      },
      {
        name: "addTodo",
        arguments: { title: "bread" },
        status: "success",
        result: { id: 2, title: "bread" },
      },
    ]);
    expect(onStep).toHaveBeenCalledTimes(2);
    expect(onToolCall).toHaveBeenCalledTimes(2);
    expect(onToolResult).toHaveBeenCalledTimes(2);
    expect(session.history).toEqual(result.steps);

    const [model] = languageModel.sessions;
    expect(model.prompts[0].input).toContain("User goal: add milk and bread");
    expect(model.prompts[0].options?.responseConstraint).toBeDefined();
    expect(model.prompts[1].input).toContain("Function results:");
    expect(model.prompts[1].input).toContain('"title":"bread"');
  });

  it("feeds tool errors and invalid arguments back to the model", async () => {
    const { tools } = createTodoTools();
    const languageModel = createMockLanguageModel([
      calls(["removeTodo", { id: 9 }], ["addTodo", { name: "x" }]),
      final("Could not do it"),
    ]);
    const session = await createAssistantSession({ tools, languageModel });

    const result = await session.run("remove todo 9");

    expect(result.steps[0].results).toEqual([
      {
        name: "removeTodo",
        arguments: { id: 9 },
        status: "error",
        error: "Todo 9 not found",
      },
      {
        name: "addTodo",
        arguments: { name: "x" },
        status: "error",
        error: "$.arguments.title is required; $.arguments.name is not allowed",
      },
    ]);
    expect(languageModel.sessions[0].prompts[1].input).toContain(
      "Todo 9 not found",
    );
  });

  it("lets onBeforeCall reject calls", async () => {
    const { todos, tools } = createTodoTools();
    const languageModel = createMockLanguageModel([
      calls(["addTodo", { title: "milk" }]),
      final("Rejected"),
    ]);
    const onBeforeCall = vi.fn(async () => false);
    const session = await createAssistantSession({
      tools,
      languageModel,
      onBeforeCall,
    });

    const result = await session.run("add milk");

    expect(onBeforeCall).toHaveBeenCalledWith(
      { name: "addTodo", arguments: { title: "milk" } },
      tools[0],
    );
    expect(todos).toEqual([]);
    expect(result.steps[0].results[0].status).toBe("rejected");
  });

  it("retries once when the model answers with invalid JSON", async () => {
    const languageModel = createMockLanguageModel(["oops", final("Done")]);
    const session = await createAssistantSession({ languageModel });

    const result = await session.run("hello");

    expect(result.message).toBe("Done");
    expect(languageModel.sessions[0].prompts[1].input).toContain(
      "Your previous answer was invalid: The answer is not valid JSON.",
    );
  });

  it("throws an AssistantResponseError after the retries", async () => {
    const languageModel = createMockLanguageModel(["oops", "still oops"]);
    const session = await createAssistantSession({ languageModel });

    const error = await session.run("hello").catch((e) => e);

    expect(error).toBeInstanceOf(AssistantResponseError);
    expect(error.response).toBe("still oops");
  });

  it("stops after maxSteps", async () => {
    const { tools } = createTodoTools();
    const languageModel = createMockLanguageModel([
      calls(["addTodo", { title: "a" }]),
      calls(["addTodo", { title: "b" }]),
      calls(["addTodo", { title: "c" }]),
    ]);
    const session = await createAssistantSession({
      tools,
      languageModel,
      maxSteps: 3,
    });

    const result = await session.run("loop", { maxSteps: 2 });

    expect(result.status).toBe("max-steps");
    expect(result.steps).toHaveLength(2);
  });

  it("aborts a run with the signal", async () => {
    const languageModel = createMockLanguageModel([final("never")]);
    const session = await createAssistantSession({ languageModel });
    const controller = new AbortController();
    controller.abort(new Error("stop"));

    await expect(
      session.run("hello", { signal: controller.signal }),
    ).rejects.toThrow("stop");
  });

  it("passes the session id and signal to the tools", async () => {
    const execute = vi.fn(() => "ok");
    const tool = defineTool({
      name: "ping",
      description: "Ping",
      parameters: { type: "object", properties: {} },
      execute,
    });
    const languageModel = createMockLanguageModel([
      calls(["ping", {}]),
      final("pong"),
    ]);
    const session = await createAssistantSession({
      tools: [tool],
      languageModel,
    });
    const controller = new AbortController();

    await session.run("ping", { signal: controller.signal });

    expect(execute).toHaveBeenCalledWith(
      {},
      { sessionId: session.id, signal: controller.signal },
    );
  });

  it("prevents concurrent runs and runs after destroy", async () => {
    const languageModel = createMockLanguageModel([final("a"), final("b")]);
    const session = await createAssistantSession({ languageModel });

    const first = session.run("a");
    await expect(session.run("b")).rejects.toThrow(
      "A run is already in progress",
    );
    await first;

    session.destroy();
    session.destroy();
    expect(languageModel.sessions[0].destroyed).toBe(true);
    await expect(session.run("c")).rejects.toThrow(
      "The assistant session is destroyed",
    );
  });

  it("supports multiple independent sessions", async () => {
    const languageModel = createMockLanguageModel([
      final("first"),
      final("second"),
    ]);
    const first = await createAssistantSession({ languageModel });
    const second = await createAssistantSession({ languageModel });

    expect(first.id).not.toBe(second.id);
    await expect(first.run("one")).resolves.toMatchObject({
      message: "first",
    });
    await expect(second.run("two")).resolves.toMatchObject({
      message: "second",
    });
    expect(first.history).toHaveLength(1);
    expect(second.history).toHaveLength(1);
    expect(languageModel.sessions).toHaveLength(2);
    expect(languageModel.sessions[0].prompts).toHaveLength(1);
    expect(languageModel.sessions[1].prompts).toHaveLength(1);
  });
});
