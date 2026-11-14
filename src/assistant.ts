import { getLanguageModel, type LanguageModelCreateOptions, type LanguageModelSession } from "./languageModel";
import {
  buildInstructions,
  buildResponseSchema,
  formatGoal,
  formatInvalidResponse,
  formatToolResults,
  parseResponse,
} from "./protocol";
import { validateSchema } from "./schema";
import { assertValidTools } from "./tools";
import type {
  AnyTool,
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

/**
 * Assistant is an independent agentic assistant backed by its own `LanguageModel` session,
 * initialized with the instructions to answer only with JSON calls of the given tools.
 *
 * Create it with `Assistant.createSession` and list the live ones with `Assistant.listSessions`.
 */
export class Assistant {
  static readonly #registry = new Set<Assistant>();

  /**
   * createSession creates a new assistant backed by a new `LanguageModel` session.
   */
  static async createSession(
    options: AssistantOptions = {},
  ): Promise<Assistant> {
    const {
      tools = [],
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
    assertValidTools(tools);

    const assistantTools: readonly AnyTool[] = [...tools];
    const model = await languageModel.create({
      expectedInputs: defaultExpected,
      expectedOutputs: defaultExpected,
      ...languageModelOptions,
      initialPrompts: [
        {
          role: "system",
          content: buildInstructions(assistantTools, instructions),
        },
      ],
      monitor,
      signal,
    } as LanguageModelCreateOptions);

    const assistant = new Assistant(model, assistantTools, {
      maxSteps,
      maxRetries,
      onBeforeCall,
      onStep,
      onToolCall,
      onToolResult,
    });
    Assistant.#registry.add(assistant);
    return assistant;
  }

  /**
   * listSessions yields the live assistants (created and not destroyed) in creation order.
   */
  static async *listSessions(): AsyncIterableIterator<Assistant> {
    for (const assistant of [...Assistant.#registry]) {
      if (Assistant.#registry.has(assistant)) yield assistant;
    }
  }

  /** unique id of the assistant */
  readonly id: string = createAssistantId();
  /** the tools the assistant can call */
  readonly tools: readonly AnyTool[];

  readonly #model: LanguageModelSession;
  readonly #settings: AssistantSettings;
  readonly #toolsByName: Map<string, AnyTool>;
  readonly #responseConstraint: JSONSchema;
  readonly #history: Step[] = [];
  #destroyed = false;
  #running = false;

  private constructor(
    model: LanguageModelSession,
    tools: readonly AnyTool[],
    settings: AssistantSettings,
  ) {
    this.#model = model;
    this.tools = tools;
    this.#settings = settings;
    this.#toolsByName = new Map(tools.map((tool) => [tool.name, tool]));
    this.#responseConstraint = buildResponseSchema(tools);
  }

  /** all the steps of all the runs */
  get history(): readonly Step[] {
    return this.#history;
  }

  async #prompt(
    input: string,
    signal?: AbortSignal,
  ): Promise<AssistantResponse> {
    const { maxRetries } = this.#settings;
    let text = "";
    let nextInput = input;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      throwIfAborted(signal);
      text = await this.#model.prompt(nextInput, {
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
   * reached.
   */
  async run(goal: string, options: RunOptions = {}): Promise<RunResult> {
    if (this.#destroyed) throw new Error("The assistant is destroyed");
    if (this.#running) throw new Error("A run is already in progress");
    this.#running = true;
    const { onStep, onToolResult } = this.#settings;
    const { signal } = options;
    const maxSteps = options.maxSteps ?? this.#settings.maxSteps;
    const steps: Step[] = [];
    try {
      let input = formatGoal(goal);
      for (let index = 0; index < maxSteps; index++) {
        const response = await this.#prompt(input, signal);
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
          return { status: "completed", message: response.message, steps };
        }
        input = formatToolResults(results);
      }
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
   * `Assistant.listSessions`.
   */
  destroy(): void {
    if (this.#destroyed) return;
    this.#destroyed = true;
    Assistant.#registry.delete(this);
    this.#model.destroy();
  }
}
