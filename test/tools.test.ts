import { assertValidTools, defineTool } from "../src/tools";
import type { AnyTool } from "../src/types";

const tool = (overrides: Partial<AnyTool> = {}): AnyTool => ({
  name: "addTodo",
  description: "Add a todo",
  parameters: { type: "object", properties: {} },
  execute: () => undefined,
  ...overrides,
});

describe("defineTool", () => {
  it("returns the tool when it is valid", () => {
    const valid = tool();
    expect(defineTool(valid)).toBe(valid);
  });

  it.each([
    [{ name: "add todo" }, /Invalid tool name/],
    [{ name: "" }, /Invalid tool name/],
    [{ description: " " }, /must have a description/],
    [{ parameters: { type: "string" } }, /JSON Schema of type "object"/],
    [{ execute: undefined }, /must have an execute function/],
  ] as [Partial<AnyTool>, RegExp][])("throws for %o", (overrides, error) => {
    expect(() => defineTool(tool(overrides))).toThrow(error);
  });
});

describe("assertValidTools", () => {
  it("throws on duplicated names", () => {
    expect(() => assertValidTools([tool(), tool()])).toThrow(
      'Duplicated tool name "addTodo"',
    );
  });

  it("accepts unique tools", () => {
    expect(() =>
      assertValidTools([tool(), tool({ name: "removeTodo" })]),
    ).not.toThrow();
  });
});
