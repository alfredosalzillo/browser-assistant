import { validateSchema } from "./schema";
import type {
  AnyTool,
  AssistantResponse,
  JSONSchema,
  ToolResult,
} from "./types";

const baseInstructions = `You are an agentic assistant running inside a web page.
You reach the goal of the user ONLY by calling the available functions listed below.
You MUST answer ONLY with a single JSON object, without markdown and without any other text, using exactly one of these formats:
1. To call functions: {"type":"calls","reasoning":"<short explanation>","calls":[{"name":"<function name>","arguments":{<arguments>}}]}
2. To finish: {"type":"final","message":"<clear message for the user>"}
Rules:
- Call only the available functions, with arguments matching their JSON Schema.
- Calls are executed in order; you receive their results as JSON, use them to decide the next calls.
- Never invent results: call a function to read data you don't know.
- Answer with "final" when the goal is reached, or when it cannot be reached with the available functions.`;

const describeTool = (tool: AnyTool) =>
  `- ${tool.name}: ${tool.description}\n  arguments JSON Schema: ${JSON.stringify(tool.parameters)}`;

/**
 * buildInstructions returns the system instructions used to initialize the `LanguageModel`.
 */
export const buildInstructions = (
  tools: readonly AnyTool[],
  instructions?: string,
): string => {
  const functions =
    tools.length > 0
      ? tools.map(describeTool).join("\n")
      : "- no functions available, always answer with type final";
  const extra = instructions?.trim()
    ? `\n\nAdditional instructions:\n${instructions.trim()}`
    : "";
  return `${baseInstructions}\n\nAvailable functions:\n${functions}${extra}`;
};

const finalResponseSchema: JSONSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["final"] },
    message: { type: "string" },
  },
  required: ["type", "message"],
  additionalProperties: false,
};

const toolCallSchema = (tool: AnyTool): JSONSchema => ({
  type: "object",
  properties: {
    name: { type: "string", enum: [tool.name] },
    arguments: tool.parameters,
  },
  required: ["name", "arguments"],
  additionalProperties: false,
});

/**
 * buildResponseSchema returns the JSON Schema of the answers of the model, used as
 * `responseConstraint` of the `LanguageModel` prompts.
 */
export const buildResponseSchema = (tools: readonly AnyTool[]): JSONSchema => {
  if (tools.length === 0) return finalResponseSchema;
  return {
    anyOf: [
      {
        type: "object",
        properties: {
          type: { type: "string", enum: ["calls"] },
          reasoning: { type: "string" },
          calls: {
            type: "array",
            minItems: 1,
            items: { anyOf: tools.map(toolCallSchema) },
          },
        },
        required: ["type", "reasoning", "calls"],
        additionalProperties: false,
      },
      finalResponseSchema,
    ],
  };
};

export type ParseResponseResult =
  | { ok: true; response: AssistantResponse }
  | { ok: false; error: string };

const stripCodeFences = (text: string) =>
  text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * parseResponse parses and validates the text answered by the model.
 * Arguments of the calls are validated later, when the calls are executed, to let the model
 * recover from invalid arguments.
 */
export const parseResponse = (
  text: string,
  tools: readonly AnyTool[],
): ParseResponseResult => {
  let value: unknown;
  try {
    value = JSON.parse(stripCodeFences(text));
  } catch {
    return { ok: false, error: "The answer is not valid JSON" };
  }
  if (!isObject(value)) {
    return { ok: false, error: "The answer must be a JSON object" };
  }
  if (value.type === "final") {
    const errors = validateSchema(finalResponseSchema, value);
    if (errors.length > 0) return { ok: false, error: errors.join("; ") };
    return { ok: true, response: value as AssistantResponse };
  }
  if (value.type === "calls") {
    if (tools.length === 0) {
      return { ok: false, error: 'No functions available, use type "final"' };
    }
    if (typeof value.reasoning !== "string") {
      value.reasoning = "";
    }
    if (!Array.isArray(value.calls) || value.calls.length === 0) {
      return { ok: false, error: "$.calls must be a non empty array" };
    }
    const names = new Set(tools.map((tool) => tool.name));
    const errors = value.calls.flatMap((call: unknown, index) => {
      if (!isObject(call)) return [`$.calls[${index}] must be an object`];
      if (typeof call.name !== "string" || !names.has(call.name)) {
        return [
          `$.calls[${index}].name must be one of ${[...names].join(", ")}`,
        ];
      }
      if (call.arguments === undefined) call.arguments = {};
      if (!isObject(call.arguments)) {
        return [`$.calls[${index}].arguments must be an object`];
      }
      return [];
    });
    if (errors.length > 0) return { ok: false, error: errors.join("; ") };
    return { ok: true, response: value as AssistantResponse };
  }
  return { ok: false, error: '$.type must be "calls" or "final"' };
};

/**
 * formatGoal returns the prompt sent to the model to start a run.
 */
export const formatGoal = (goal: string): string =>
  `User goal: ${goal}\nAnswer with the next JSON object.`;

/**
 * formatToolResults returns the prompt sent to the model with the results of the calls.
 */
export const formatToolResults = (results: readonly ToolResult[]): string =>
  `Function results: ${JSON.stringify(results)}\nContinue toward the goal of the user. Answer with the next JSON object.`;

/**
 * formatInvalidResponse returns the prompt sent to the model when its answer is not valid.
 */
export const formatInvalidResponse = (error: string): string =>
  `Your previous answer was invalid: ${error}.\nAnswer again with only one valid JSON object.`;
