import { getLanguageModel, type LanguageModelSession } from "./languageModel";
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
  AssistantResponse,
  AssistantSession,
  AssistantSessionOptions,
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

let sessionCounter = 0;
const createSessionId = () =>
  globalThis.crypto?.randomUUID?.() ?? `session-${++sessionCounter}`;

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) {
    throw signal.reason ?? new DOMException("Aborted", "AbortError");
  }
};

/**
 * createAssistantSession creates an independent assistant session backed by a new
 * `LanguageModel` session, initialized with the instructions to answer only with JSON calls of
 * the given tools.
 */
export const createAssistantSession = async (
  options: AssistantSessionOptions = {},
): Promise<AssistantSession> => {
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

  const sessionTools: readonly AnyTool[] = [...tools];
  const toolsByName = new Map(sessionTools.map((tool) => [tool.name, tool]));
  const responseConstraint = buildResponseSchema(sessionTools);
  const id = createSessionId();
  const history: Step[] = [];

  const model: LanguageModelSession = await languageModel.create({
    expectedInputs: defaultExpected,
    expectedOutputs: defaultExpected,
    ...languageModelOptions,
    initialPrompts: [
      {
        role: "system",
        content: buildInstructions(sessionTools, instructions),
      },
    ],
    monitor,
    signal,
  });

  let destroyed = false;
  let running = false;

  const prompt = async (
    input: string,
    runSignal?: AbortSignal,
  ): Promise<AssistantResponse> => {
    let text = "";
    let nextInput = input;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      throwIfAborted(runSignal);
      text = await model.prompt(nextInput, {
        responseConstraint,
        signal: runSignal,
      });
      const parsed = parseResponse(text, sessionTools);
      if (parsed.ok) return parsed.response;
      nextInput = formatInvalidResponse(parsed.error);
    }
    throw new AssistantResponseError(
      `The model answered with an invalid response after ${maxRetries + 1} attempts`,
      text,
    );
  };

  const execute = async (
    call: ToolCall,
    runSignal?: AbortSignal,
  ): Promise<ToolResult> => {
    const tool = toolsByName.get(call.name);
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
        sessionId: id,
        signal: runSignal,
      });
      return { ...call, status: "success", result };
    } catch (error) {
      return { ...call, status: "error", error: errorMessage(error) };
    }
  };

  const run = async (
    goal: string,
    runOptions: RunOptions = {},
  ): Promise<RunResult> => {
    if (destroyed) throw new Error("The assistant session is destroyed");
    if (running) throw new Error("A run is already in progress");
    running = true;
    const runSignal = runOptions.signal;
    const runMaxSteps = runOptions.maxSteps ?? maxSteps;
    const steps: Step[] = [];
    try {
      let input = formatGoal(goal);
      for (let index = 0; index < runMaxSteps; index++) {
        const response = await prompt(input, runSignal);
        const results: ToolResult[] = [];
        if (response.type === "calls") {
          for (const call of response.calls) {
            throwIfAborted(runSignal);
            const result = await execute(call, runSignal);
            results.push(result);
            onToolResult?.(result);
          }
        }
        const step: Step = { index, goal, response, results };
        steps.push(step);
        history.push(step);
        onStep?.(step);
        if (response.type === "final") {
          return { status: "completed", message: response.message, steps };
        }
        input = formatToolResults(results);
      }
      return {
        status: "max-steps",
        message: `Stopped after ${runMaxSteps} steps without reaching the goal.`,
        steps,
      };
    } finally {
      running = false;
    }
  };

  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    model.destroy();
  };

  return {
    id,
    tools: sessionTools,
    history,
    run,
    destroy,
  };
};
