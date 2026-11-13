import type {
  LanguageModelCreateOptions,
  LanguageModelStatic,
} from "./languageModel";

export type JSONSchemaType =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "object"
  | "array"
  | "null";

/**
 * Subset of JSON Schema supported by the library to describe tool arguments.
 */
export type JSONSchema = {
  type?: JSONSchemaType | JSONSchemaType[];
  description?: string;
  enum?: unknown[];
  const?: unknown;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  additionalProperties?: boolean | JSONSchema;
  items?: JSONSchema;
  minItems?: number;
  maxItems?: number;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  anyOf?: JSONSchema[];
  oneOf?: JSONSchema[];
  [keyword: string]: unknown;
};

export type ToolContext = {
  /** id of the assistant running the tool */
  sessionId: string;
  /** abort signal of the current run */
  signal?: AbortSignal;
};

/**
 * A JavaScript function the assistant can call.
 */
export type Tool<Args = Record<string, unknown>, Result = unknown> = {
  /** unique name of the function, must match `/^[a-zA-Z_][a-zA-Z0-9_]*$/` */
  name: string;
  /** what the function does, used by the model to decide when to call it */
  description: string;
  /** JSON Schema of the arguments object */
  parameters: JSONSchema;
  /** implementation of the function */
  execute: (args: Args, context: ToolContext) => Result | Promise<Result>;
};

// biome-ignore lint/suspicious/noExplicitAny: tools with any arguments are accepted by an assistant
export type AnyTool = Tool<any, unknown>;

export type ToolCall = {
  name: string;
  arguments: Record<string, unknown>;
};

export type CallsResponse = {
  type: "calls";
  reasoning: string;
  calls: ToolCall[];
};

export type FinalResponse = {
  type: "final";
  message: string;
};

/**
 * The JSON object the model must answer with.
 */
export type AssistantResponse = CallsResponse | FinalResponse;

export type ToolResultStatus = "success" | "error" | "rejected";

export type ToolResult = ToolCall & {
  status: ToolResultStatus;
  result?: unknown;
  error?: string;
};

export type Step = {
  /** index of the step inside its run */
  index: number;
  /** goal of the run the step belongs to */
  goal: string;
  response: AssistantResponse;
  results: ToolResult[];
};

export type RunStatus = "completed" | "max-steps";

export type RunResult = {
  status: RunStatus;
  message: string;
  steps: Step[];
};

export type RunOptions = {
  signal?: AbortSignal;
  maxSteps?: number;
};

/**
 * Options of `Assistant.createSession`.
 */
export type AssistantOptions = {
  tools?: AnyTool[];
  instructions?: string;
  maxSteps?: number;
  maxRetries?: number;
  onBeforeCall?: (call: ToolCall, tool: AnyTool) => boolean | Promise<boolean>;
  onStep?: (step: Step) => void;
  onToolCall?: (call: ToolCall) => void;
  onToolResult?: (result: ToolResult) => void;
  monitor?: LanguageModelCreateOptions["monitor"];
  signal?: AbortSignal;
  languageModelOptions?: Omit<
    LanguageModelCreateOptions,
    "initialPrompts" | "monitor" | "signal"
  >;
  languageModel?: LanguageModelStatic;
};
