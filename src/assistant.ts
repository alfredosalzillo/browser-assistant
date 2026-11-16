import {
  getLanguageModel,
  type LanguageModelCreateOptions,
  type LanguageModelSession,
} from "./languageModel";
import {
  buildInstructions,
  buildResponseSchema,
  formatGoal,
  formatInvalidResponse,
  formatToolResults,
  parseResponse,
} from "./protocol";
import { validateSchema } from "./schema";
import {
  type AssistantStorage,
  type InMemoryStorage,
  LocalStorage,
} from "./storage";
import { assertValidTools } from "./tools";
import type {
  AnyTool,
  AssistantConfig,
  AssistantOptions,
  AssistantResponse,
  JSONSchema,
  RunOptions,
  RunResult,
  Step,
  ToolCall,
  ToolResult,
} from "./types";

const defaultMaxSteps = 10;
const defaultMaxRetries = 1;
const defaultExpected = [{ type: "text" as const, languages: ["en"] }];

const STORAGE_KEY = "browser-assistant:sessions";

/**
 * Error thrown when the model keeps answering with an invalid JSON object.
 */
export class AssistantResponseError extends Error {
  readonly response: string;

  constructor(message: string, response: string) {
    super(message);
    this.name = "AssistantResponseError";
    this.response = response;
  }
}

let assistantCounter = 0;
const createAssistantId = () =>
  globalThis.crypto?.randomUUID?.() ?? `assistant-${++assistantCounter}`;

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) {
    throw signal.reason ?? new DOMException("Aborted", "AbortError");
  }
};

type AssistantSettings = Pick<
  AssistantOptions,
  "onBeforeCall" | "onStep" | "onToolCall" | "onToolResult"
> & {
  maxSteps: number;
  maxRetries: number;
};

/** Serialized form of an Assistant stored in the storage layer. */
type SerializedSession = {
  id: string;
  toolNames: string[];
  /** tools removed from the config that the model has not been told about yet */
  removedToolNames?: string[];
  instructions?: string;
  maxSteps: number;
  maxRetries: number;
  history: Step[];
  createdAt: number;
};

/** Resolves an `AssistantStorage`-compatible instance from a config storage value. */
const resolveStorage = (
  storage: AssistantConfig["storage"],
): AssistantStorage => {
  if (storage == null) return LocalStorage;
  // Static class (e.g. LocalStorage or InMemoryStorage passed as class itself)
  if (typeof storage === "function") {
    return {
      getItem: (k) => (storage as typeof InMemoryStorage).getItem(k),
      setItem: (k, v) => (storage as typeof InMemoryStorage).setItem(k, v),
      removeItem: (k) => (storage as typeof InMemoryStorage).removeItem(k),
    };
  }
  return storage;
};

/**
 * Assistant is an independent agentic assistant backed by its own `LanguageModel` session,
 * initialized with the instructions to answer only with JSON calls of the given tools.
 *
 * Before calling any method, configure tools and storage with `Assistant.config`.
 * Create sessions with `Assistant.createSession` and list the live ones with `Assistant.listSessions`.
 */
export class Assistant {
  // ---------------------------------------------------------------------------
  // Static: configuration & registry
  // ---------------------------------------------------------------------------

  static #config: AssistantConfig = {};
  static #storage: AssistantStorage = LocalStorage;
  static #configLocked = false;
  static #hydrated = false;
  static readonly #registry = new Map<string, Assistant>();

  /**
   * config sets the global configuration for all assistant sessions.
   *
   * Must be called **before** `createSession` or `listSessions`. Calling it after those
   * methods throws an Error.
   *
   * @example
   * ```ts
   * Assistant.config({ storage: LocalStorage, tools: [myTool] });
   * ```
   */
  static config(options: AssistantConfig): void {
    if (Assistant.#configLocked) {
      throw new Error(
        "Assistant.config must be called before createSession or listSessions",
      );
    }
    if (options.tools) assertValidTools(options.tools);
    Assistant.#config = { ...Assistant.#config, ...options };
    Assistant.#storage = resolveStorage(Assistant.#config.storage);
  }

  /**
   * @internal Resets all static state. Used in tests to isolate test cases.
   */
  static _reset(): void {
    for (const assistant of Assistant.#registry.values()) {
      if (assistant.#model) {
        try {
          assistant.#model.destroy();
        } catch {
          // ignore
        }
      }
    }
    Assistant.#registry.clear();
    Assistant.#config = {};
    Assistant.#storage = LocalStorage;
    Assistant.#configLocked = false;
    Assistant.#hydrated = false;
  }

  /**
   * Hydrates sessions from storage into the in-memory registry.
   * Called once, lazily, before the first createSession or listSessions call.
   */
  static async #hydrate(): Promise<void> {
    if (Assistant.#hydrated) return;
    Assistant.#configLocked = true;
    Assistant.#hydrated = true;

    const raw = await Assistant.#storage.getItem(STORAGE_KEY);
    if (!raw) return;

    let records: SerializedSession[];
    try {
      records = JSON.parse(raw);
    } catch {
      return;
    }
    if (!Array.isArray(records)) return;

    const configuredTools = new Map<string, AnyTool>(
      (Assistant.#config.tools ?? []).map((t) => [t.name, t]),
    );

    for (const record of records) {
      if (Assistant.#registry.has(record.id)) continue;

      // Determine which tools still exist in config
      const availableToolNames = record.toolNames.filter((n) =>
        configuredTools.has(n),
      );
      const removedToolNames = [
        ...new Set([
          ...(record.removedToolNames ?? []),
          ...record.toolNames.filter((n) => !configuredTools.has(n)),
        ]),
      ];
      const tools = availableToolNames.map(
        (n) => configuredTools.get(n) as AnyTool,
      );

      const assistant = new Assistant(
        null, // lazy — LanguageModel not created yet
        tools,
        availableToolNames,
        {
          maxSteps: record.maxSteps,
          maxRetries: record.maxRetries,
          onBeforeCall: undefined,
          onStep: undefined,
          onToolCall: undefined,
          onToolResult: undefined,
        },
        record.instructions,
        record.history,
        removedToolNames,
        record.id,
        record.createdAt,
      );

      Assistant.#registry.set(assistant.id, assistant);
    }
  }

  /**
   * Persists all in-registry sessions to storage.
   */
  static async #persist(): Promise<void> {
    const records: SerializedSession[] = [];
    for (const assistant of Assistant.#registry.values()) {
      records.push({
        id: assistant.id,
        toolNames: assistant.#toolNames,
        removedToolNames: assistant.#removedToolNames,
        instructions: assistant.#instructions,
        maxSteps: assistant.#settings.maxSteps,
        maxRetries: assistant.#settings.maxRetries,
        history: [...assistant.#history],
        createdAt: assistant.#createdAt,
      });
    }
    // Sort by creation time to preserve order across reloads
    records.sort((a, b) => a.createdAt - b.createdAt);
    await Assistant.#storage.setItem(STORAGE_KEY, JSON.stringify(records));
  }

  /**
   * createSession creates a new assistant backed by a new `LanguageModel` session.
   *
   * Tools must be registered via `Assistant.config({ tools: [...] })` before calling this.
   * Pass `toolNames` to select a subset of the configured tools for this session.
   */
  static async createSession(
    options: AssistantOptions = {},
  ): Promise<Assistant> {
    await Assistant.#hydrate();

    const {
      toolNames,
      instructions,
      maxSteps = defaultMaxSteps,
      maxRetries = defaultMaxRetries,
      onBeforeCall,
      onStep,
      onToolCall,
      onToolResult,
      monitor,
      signal,
      languageModelOptions,
      languageModel = getLanguageModel(),
    } = options;

    if (!languageModel) {
      throw new Error("LanguageModel is not supported in this browser");
    }

    // Resolve tools from config using the given toolNames (or all if not specified)
    const configuredTools = new Map<string, AnyTool>(
      (Assistant.#config.tools ?? []).map((t) => [t.name, t]),
    );

    const resolvedToolNames: string[] = toolNames ?? [
      ...configuredTools.keys(),
    ];

    const tools: AnyTool[] = resolvedToolNames.map((name) => {
      const tool = configuredTools.get(name);
      if (!tool) {
        throw new Error(
          `Tool "${name}" is not registered. Register it via Assistant.config({ tools: [...] }).`,
        );
      }
      return tool;
    });

    assertValidTools(tools);

    const model = await languageModel.create({
      expectedInputs: defaultExpected,
      expectedOutputs: defaultExpected,
      ...languageModelOptions,
      initialPrompts: [
        {
          role: "system",
          content: buildInstructions(tools, instructions),
        },
      ],
      monitor,
      signal,
    } as LanguageModelCreateOptions);

    const assistant = new Assistant(
      model,
      tools,
      resolvedToolNames,
      {
        maxSteps,
        maxRetries,
        onBeforeCall,
        onStep,
        onToolCall,
        onToolResult,
      },
      instructions,
      [],
      [],
    );

    Assistant.#registry.set(assistant.id, assistant);
    await Assistant.#persist();
    return assistant;
  }

  /**
   * listSessions yields the live assistants (created and not destroyed) in creation order.
   */
  static async *listSessions(): AsyncIterableIterator<Assistant> {
    await Assistant.#hydrate();
    // Sort by createdAt to yield in creation order (including hydrated sessions)
    const sorted = [...Assistant.#registry.values()].sort(
      (a, b) => a.#createdAt - b.#createdAt,
    );
    for (const assistant of sorted) {
      if (Assistant.#registry.has(assistant.id)) yield assistant;
    }
  }

  // ---------------------------------------------------------------------------
  // Instance
  // ---------------------------------------------------------------------------

  /** Unique id of the assistant */
  readonly id: string;
  /** The tools the assistant can call */
  readonly tools: readonly AnyTool[];

  #model: LanguageModelSession | null;
  readonly #toolNames: string[];
  readonly #instructions: string | undefined;
  readonly #settings: AssistantSettings;
  readonly #toolsByName: Map<string, AnyTool>;
  readonly #responseConstraint: JSONSchema;
  readonly #history: Step[];
  readonly #createdAt: number;
  /** Tool names that existed in a previous session but are no longer in config. */
  #removedToolNames: string[];
  #destroyed = false;
  #running = false;

  private constructor(
    model: LanguageModelSession | null,
    tools: readonly AnyTool[],
    toolNames: string[],
    settings: AssistantSettings,
    instructions?: string,
    history: Step[] = [],
    removedToolNames: string[] = [],
    id?: string,
    createdAt?: number,
  ) {
    this.id = id ?? createAssistantId();
    this.#model = model;
    this.tools = tools;
    this.#toolNames = toolNames;
    this.#instructions = instructions;
    this.#settings = settings;
    this.#toolsByName = new Map(tools.map((tool) => [tool.name, tool]));
    this.#responseConstraint = buildResponseSchema(tools);
    this.#history = history;
    this.#removedToolNames = removedToolNames;
    this.#createdAt = createdAt ?? Date.now();
  }

  /** All the steps of all the runs */
  get history(): readonly Step[] {
    return this.#history;
  }

  /**
   * Lazily initializes the LanguageModel session on the first interaction.
   * Also notifies the model of any tools removed since the session was persisted.
   */
  async #ensureModel(
    languageModel = getLanguageModel(),
    monitor?: LanguageModelCreateOptions["monitor"],
    signal?: AbortSignal,
  ): Promise<LanguageModelSession> {
    if (this.#model) return this.#model;

    if (!languageModel) {
      throw new Error("LanguageModel is not supported in this browser");
    }

    // Create the LanguageModel session for a hydrated (restored) assistant
    this.#model = await languageModel.create({
      expectedInputs: defaultExpected,
      expectedOutputs: defaultExpected,
      initialPrompts: [
        {
          role: "system",
          content: buildInstructions(this.tools, this.#instructions),
        },
      ],
      monitor,
      signal,
    } as LanguageModelCreateOptions);

    // Notify the model about removed tools and record in history
    if (this.#removedToolNames.length > 0) {
      const removed = this.#removedToolNames;
      this.#removedToolNames = [];

      const removalMessage = `The following tools are no longer available and have been removed: ${removed.join(", ")}. Do not attempt to call them.`;

      // Append to the session context so the model is aware, without asking for an answer
      await this.#model.append(`[System notice] ${removalMessage}`);

      // Record the removal in the session history as a final-type system step
      const removalStep: Step = {
        index: this.#history.length,
        goal: "[system] tool removal notification",
        response: { type: "final", message: removalMessage },
        results: [],
      };
      this.#history.push(removalStep);
      this.#settings.onStep?.(removalStep);

      // Persist updated history
      await Assistant.#persist();
    }

    return this.#model;
  }

  async #prompt(
    input: string,
    signal: AbortSignal | undefined,
    session: LanguageModelSession,
  ): Promise<AssistantResponse> {
    const { maxRetries } = this.#settings;
    let text = "";
    let nextInput = input;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      throwIfAborted(signal);
      text = await session.prompt(nextInput, {
        responseConstraint: this.#responseConstraint,
        signal,
      });
      const parsed = parseResponse(text, this.tools);
      if (parsed.ok) return parsed.response;
      nextInput = formatInvalidResponse(parsed.error);
    }
    throw new AssistantResponseError(
      `The model answered with an invalid response after ${maxRetries + 1} attempts`,
      text,
    );
  }

  async #execute(call: ToolCall, signal?: AbortSignal): Promise<ToolResult> {
    const { onBeforeCall, onToolCall } = this.#settings;
    const tool = this.#toolsByName.get(call.name);
    if (!tool) {
      return {
        ...call,
        status: "error",
        error: `Unknown function ${call.name}`,
      };
    }
    const errors = validateSchema(
      tool.parameters,
      call.arguments,
      "$.arguments",
    );
    if (errors.length > 0) {
      return { ...call, status: "error", error: errors.join("; ") };
    }
    if (onBeforeCall && !(await onBeforeCall(call, tool))) {
      return {
        ...call,
        status: "rejected",
        error: "Call rejected by the user",
      };
    }
    onToolCall?.(call);
    try {
      const result = await tool.execute(call.arguments, {
        sessionId: this.id,
        signal,
      });
      return { ...call, status: "success", result };
    } catch (error) {
      return { ...call, status: "error", error: errorMessage(error) };
    }
  }

  /**
   * run runs the agentic loop until the model answers with a final message or `maxSteps` is
   * reached. On first call for a restored session, the LanguageModel is initialized lazily.
   */
  async run(goal: string, options: RunOptions = {}): Promise<RunResult> {
    if (this.#destroyed) throw new Error("The assistant is destroyed");
    if (this.#running) throw new Error("A run is already in progress");
    this.#running = true;
    const { onStep, onToolResult } = this.#settings;
    const { signal, languageModel = getLanguageModel(), monitor } = options;
    const maxSteps = options.maxSteps ?? this.#settings.maxSteps;
    const steps: Step[] = [];
    try {
      // Lazy initialization: create the LanguageModel session on first run
      const model = await this.#ensureModel(languageModel, monitor, signal);

      let input = formatGoal(goal);
      for (let index = 0; index < maxSteps; index++) {
        const response = await this.#prompt(input, signal, model);
        const results: ToolResult[] = [];
        if (response.type === "calls") {
          for (const call of response.calls) {
            throwIfAborted(signal);
            const result = await this.#execute(call, signal);
            results.push(result);
            onToolResult?.(result);
          }
        }
        const step: Step = { index, goal, response, results };
        steps.push(step);
        this.#history.push(step);
        onStep?.(step);
        if (response.type === "final") {
          await Assistant.#persist();
          return { status: "completed", message: response.message, steps };
        }
        input = formatToolResults(results);
      }
      await Assistant.#persist();
      return {
        status: "max-steps",
        message: `Stopped after ${maxSteps} steps without reaching the goal.`,
        steps,
      };
    } finally {
      this.#running = false;
    }
  }

  /**
   * destroy destroys the underlying `LanguageModel` session and removes the assistant from
   * `Assistant.listSessions` and from storage.
   */
  destroy(): void {
    if (this.#destroyed) return;
    this.#destroyed = true;
    Assistant.#registry.delete(this.id);
    if (this.#model) this.#model.destroy();
    // Fire-and-forget persist to remove from storage
    Assistant.#persist().catch(() => undefined);
  }
}
