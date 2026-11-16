import { Assistant, AssistantResponseError } from "../src/assistant";
import { InMemoryStorage, LocalStorage } from "../src/storage";
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

const listAssistants = async () => {
  const assistants: Assistant[] = [];
  for await (const assistant of Assistant.listSessions())
    assistants.push(assistant);
  return assistants;
};

const configure = (tools: AnyTool[] = []) =>
  Assistant.config({ storage: new InMemoryStorage(), tools });

describe("Assistant", () => {
  beforeEach(() => {
    Assistant._reset();
    configure();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Assistant._reset();
  });

  it("creates an Assistant instance with a Promise", async () => {
    const { tools } = createTodoTools();
    configure(tools);
    const promise = Assistant.createSession({
      languageModel: createMockLanguageModel(),
    });

    expect(promise).toBeInstanceOf(Promise);
    const assistant = await promise;
    expect(assistant).toBeInstanceOf(Assistant);
    expect(typeof assistant.id).toBe("string");
    expect(assistant.tools).toEqual(tools);
    expect(assistant.tools).not.toBe(tools);
    expect(assistant.history).toEqual([]);
  });

  it("lists the live assistants in creation order", async () => {
    const languageModel = createMockLanguageModel();
    await expect(listAssistants()).resolves.toEqual([]);

    const first = await Assistant.createSession({ languageModel });
    const second = await Assistant.createSession({ languageModel });
    const third = await Assistant.createSession({ languageModel });

    await expect(listAssistants()).resolves.toEqual([first, second, third]);
  });

  it("excludes the destroyed assistants from listSessions", async () => {
    const languageModel = createMockLanguageModel();
    const first = await Assistant.createSession({ languageModel });
    const second = await Assistant.createSession({ languageModel });
    const third = await Assistant.createSession({ languageModel });

    second.destroy();
    await expect(listAssistants()).resolves.toEqual([first, third]);

    first.destroy();
    third.destroy();
    await expect(listAssistants()).resolves.toEqual([]);
  });

  it("skips the assistants destroyed while iterating listSessions", async () => {
    const languageModel = createMockLanguageModel();
    const first = await Assistant.createSession({ languageModel });
    const second = await Assistant.createSession({ languageModel });
    const yielded: Assistant[] = [];

    for await (const assistant of Assistant.listSessions()) {
      yielded.push(assistant);
      second.destroy();
    }

    expect(yielded).toEqual([first]);
  });

  it("returns an async iterator from listSessions", async () => {
    const assistant = await Assistant.createSession({
      languageModel: createMockLanguageModel(),
    });
    const iterator = Assistant.listSessions();

    expect(iterator[Symbol.asyncIterator]()).toBe(iterator);
    await expect(iterator.next()).resolves.toEqual({
      done: false,
      value: assistant,
    });
    await expect(iterator.next()).resolves.toEqual({
      done: true,
      value: undefined,
    });
  });

  it("does not list an assistant whose creation failed", async () => {
    const languageModel = createMockLanguageModel();
    const controller = new AbortController();
    controller.abort(new Error("stop"));
    languageModel.create = async () => {
      throw controller.signal.reason;
    };

    await expect(
      Assistant.createSession({ languageModel, signal: controller.signal }),
    ).rejects.toThrow("stop");
    await expect(listAssistants()).resolves.toEqual([]);
  });

  it("throws when LanguageModel is not supported", async () => {
    await expect(Assistant.createSession()).rejects.toThrow(
      "LanguageModel is not supported in this browser",
    );
  });

  it("throws on invalid tools", async () => {
    const { tools } = createTodoTools();
    expect(() => configure([...tools, tools[0]])).toThrow(
      "Duplicated tool name",
    );
  });

  it("initializes the LanguageModel with the JSON instructions", async () => {
    const { tools } = createTodoTools();
    const languageModel = createMockLanguageModel();
    const monitor = vi.fn();
    vi.stubGlobal("LanguageModel", languageModel);
    configure(tools);
    await Assistant.createSession({
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
    configure(tools);
    const session = await Assistant.createSession({
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
    configure(tools);
    const session = await Assistant.createSession({ languageModel });

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
    configure(tools);
    const session = await Assistant.createSession({
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
    const session = await Assistant.createSession({ languageModel });

    const result = await session.run("hello");

    expect(result.message).toBe("Done");
    expect(languageModel.sessions[0].prompts[1].input).toContain(
      "Your previous answer was invalid: The answer is not valid JSON.",
    );
  });

  it("throws an AssistantResponseError after the retries", async () => {
    const languageModel = createMockLanguageModel(["oops", "still oops"]);
    const session = await Assistant.createSession({ languageModel });

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
    configure(tools);
    const session = await Assistant.createSession({
      languageModel,
      maxSteps: 3,
    });

    const result = await session.run("loop", { maxSteps: 2 });

    expect(result.status).toBe("max-steps");
    expect(result.steps).toHaveLength(2);
  });

  it("aborts a run with the signal", async () => {
    const languageModel = createMockLanguageModel([final("never")]);
    const session = await Assistant.createSession({ languageModel });
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
    configure([tool]);
    const session = await Assistant.createSession({ languageModel });
    const controller = new AbortController();

    await session.run("ping", { signal: controller.signal });

    expect(execute).toHaveBeenCalledWith(
      {},
      { sessionId: session.id, signal: controller.signal },
    );
  });

  it("prevents concurrent runs and runs after destroy", async () => {
    const languageModel = createMockLanguageModel([final("a"), final("b")]);
    const session = await Assistant.createSession({ languageModel });

    const first = session.run("a");
    await expect(session.run("b")).rejects.toThrow(
      "A run is already in progress",
    );
    await first;

    session.destroy();
    session.destroy();
    expect(languageModel.sessions[0].destroyed).toBe(true);
    await expect(session.run("c")).rejects.toThrow(
      "The assistant is destroyed",
    );
  });

  it("supports multiple independent sessions", async () => {
    const languageModel = createMockLanguageModel([
      final("first"),
      final("second"),
    ]);
    const first = await Assistant.createSession({ languageModel });
    const second = await Assistant.createSession({ languageModel });

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

  describe("config and persistence", () => {
    const pingTool = (name: string) =>
      defineTool({
        name,
        description: `Tool ${name}`,
        parameters: { type: "object", properties: {} },
        execute: () => "ok",
      });

    it("throws when config is called after createSession or listSessions", async () => {
      configure();
      await listAssistants();
      expect(() => configure()).toThrow(
        "Assistant.config must be called before createSession or listSessions",
      );

      Assistant._reset();
      configure();
      await Assistant.createSession({
        languageModel: createMockLanguageModel(),
      });
      expect(() => configure()).toThrow("must be called before");
    });

    it("fails to create a session with a tool that is not configured", async () => {
      configure([pingTool("ping")]);
      await expect(
        Assistant.createSession({
          toolNames: ["missing"],
          languageModel: createMockLanguageModel(),
        }),
      ).rejects.toThrow('Tool "missing" is not registered');
    });

    it("selects a subset of the configured tools with toolNames", async () => {
      configure([pingTool("a"), pingTool("b")]);
      const session = await Assistant.createSession({
        toolNames: ["b"],
        languageModel: createMockLanguageModel(),
      });
      expect(session.tools.map((tool) => tool.name)).toEqual(["b"]);
    });

    it("stores the sessions asynchronously in the configured storage", async () => {
      const storage = new InMemoryStorage();
      const setItem = vi.spyOn(storage, "setItem");
      Assistant.config({ storage, tools: [pingTool("ping")] });
      const session = await Assistant.createSession({
        languageModel: createMockLanguageModel(),
      });

      expect(setItem).toHaveBeenCalled();
      const stored = JSON.parse(
        (await storage.getItem("browser-assistant:sessions")) as string,
      );
      expect(stored).toHaveLength(1);
      expect(stored[0].id).toBe(session.id);
      expect(stored[0].toolNames).toEqual(["ping"]);

      session.destroy();
      await vi.waitFor(async () => {
        expect(
          JSON.parse(
            (await storage.getItem("browser-assistant:sessions")) as string,
          ),
        ).toEqual([]);
      });
    });

    it("hydrates the stored sessions lazily and recreates the model on the first run", async () => {
      const storage = new InMemoryStorage();
      const tools = [pingTool("ping")];
      Assistant.config({ storage, tools });
      const original = await Assistant.createSession({
        instructions: "Be brief",
        languageModel: createMockLanguageModel([final("first")]),
      });
      await original.run("one");

      // simulate a page reload
      Assistant._reset();
      Assistant.config({ storage, tools });
      const sessions = await listAssistants();

      expect(sessions).toHaveLength(1);
      const [restored] = sessions;
      expect(restored.id).toBe(original.id);
      expect(restored.history).toEqual(original.history);
      expect(restored.tools.map((tool) => tool.name)).toEqual(["ping"]);

      const languageModel = createMockLanguageModel([final("second")]);
      expect(languageModel.sessions).toHaveLength(0);
      const result = await restored.run("two", { languageModel });
      expect(result.message).toBe("second");
      expect(languageModel.sessions).toHaveLength(1);
      expect(
        languageModel.sessions[0].createOptions.initialPrompts?.[0].content,
      ).toContain("Be brief");
      expect(restored.history).toHaveLength(2);
      expect(languageModel.sessions[0].appended).toEqual([]);
    });

    it("keeps the creation order across reloads", async () => {
      const storage = new InMemoryStorage();
      Assistant.config({ storage });
      const languageModel = createMockLanguageModel();
      const first = await Assistant.createSession({ languageModel });
      const second = await Assistant.createSession({ languageModel });

      Assistant._reset();
      Assistant.config({ storage });
      const ids = (await listAssistants()).map((session) => session.id);
      expect(ids).toEqual([first.id, second.id]);
    });

    it("notifies the session about the tools removed after hydration", async () => {
      const storage = new InMemoryStorage();
      Assistant.config({
        storage,
        tools: [pingTool("keep"), pingTool("gone")],
      });
      const original = await Assistant.createSession({
        languageModel: createMockLanguageModel(),
      });

      Assistant._reset();
      Assistant.config({ storage, tools: [pingTool("keep")] });
      const [restored] = await listAssistants();
      expect(restored.id).toBe(original.id);
      expect(restored.tools.map((tool) => tool.name)).toEqual(["keep"]);

      const languageModel = createMockLanguageModel([final("done")]);
      await restored.run("hello", { languageModel });

      const [model] = languageModel.sessions;
      expect(model.appended).toHaveLength(1);
      expect(String(model.appended[0])).toContain("gone");
      expect(model.createOptions.initialPrompts?.[0].content).not.toContain(
        "- gone:",
      );
      expect(restored.history[0].goal).toBe(
        "[system] tool removal notification",
      );

      // the notification is sent only once
      Assistant._reset();
      Assistant.config({ storage, tools: [pingTool("keep")] });
      const [again] = await listAssistants();
      const next = createMockLanguageModel([final("again")]);
      await again.run("hello again", { languageModel: next });
      expect(next.sessions[0].appended).toEqual([]);
    });

    it("ignores corrupted stored data", async () => {
      const storage = new InMemoryStorage();
      await storage.setItem("browser-assistant:sessions", "{not json");
      Assistant.config({ storage });
      await expect(listAssistants()).resolves.toEqual([]);
    });

    it("supports a storage passed as a class and falls back to memory without localStorage", async () => {
      vi.stubGlobal("localStorage", undefined);
      await LocalStorage.setItem("k", "v");
      await expect(LocalStorage.getItem("k")).resolves.toBe("v");
      await LocalStorage.removeItem("k");
      await expect(LocalStorage.getItem("k")).resolves.toBeNull();

      Assistant.config({ storage: InMemoryStorage });
      const session = await Assistant.createSession({
        languageModel: createMockLanguageModel(),
      });
      await expect(
        InMemoryStorage.getItem("browser-assistant:sessions"),
      ).resolves.toContain(session.id);
      session.destroy();
    });

    it("stores the sessions in localStorage by default", async () => {
      const data = new Map<string, string>();
      vi.stubGlobal("localStorage", {
        getItem: (k: string) => data.get(k) ?? null,
        setItem: (k: string, v: string) => data.set(k, v),
        removeItem: (k: string) => data.delete(k),
      });
      Assistant._reset();
      const session = await Assistant.createSession({
        languageModel: createMockLanguageModel(),
      });

      expect([...data.values()].join()).toContain(session.id);
      session.destroy();
    });

    it("uses localStorage when available", async () => {
      const data = new Map<string, string>();
      vi.stubGlobal("localStorage", {
        getItem: (k: string) => data.get(k) ?? null,
        setItem: (k: string, v: string) => data.set(k, v),
        removeItem: (k: string) => data.delete(k),
      });
      const instance = new LocalStorage();
      await instance.setItem("a", "1");
      expect(data.get("a")).toBe("1");
      await expect(instance.getItem("a")).resolves.toBe("1");
      await instance.removeItem("a");
      expect(data.has("a")).toBe(false);
    });
  });
});
