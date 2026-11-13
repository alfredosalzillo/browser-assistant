import type { AnyTool, Tool } from "./types";

const toolNamePattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/**
 * assertValidTool throws when the tool is not well defined.
 */
export const assertValidTool = (tool: AnyTool): void => {
  if (!toolNamePattern.test(tool.name ?? "")) {
    throw new TypeError(
      `Invalid tool name "${tool.name}", it must match ${toolNamePattern}`,
    );
  }
  if (typeof tool.description !== "string" || tool.description.trim() === "") {
    throw new TypeError(`Tool "${tool.name}" must have a description`);
  }
  if (tool.parameters?.type !== "object") {
    throw new TypeError(
      `Tool "${tool.name}" parameters must be a JSON Schema of type "object"`,
    );
  }
  if (typeof tool.execute !== "function") {
    throw new TypeError(`Tool "${tool.name}" must have an execute function`);
  }
};

/**
 * assertValidTools throws when a tool is not well defined or when two tools have the same name.
 */
export const assertValidTools = (tools: readonly AnyTool[]): void => {
  const names = new Set<string>();
  for (const tool of tools) {
    assertValidTool(tool);
    if (names.has(tool.name)) {
      throw new TypeError(`Duplicated tool name "${tool.name}"`);
    }
    names.add(tool.name);
  }
};

/**
 * defineTool validates and returns a tool, it is also a typed helper for the arguments of `execute`.
 */
export const defineTool = <Args = Record<string, unknown>, Result = unknown>(
  tool: Tool<Args, Result>,
): Tool<Args, Result> => {
  assertValidTool(tool as AnyTool);
  return tool;
};
