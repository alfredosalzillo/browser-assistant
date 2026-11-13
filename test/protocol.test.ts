import {
  buildInstructions,
  buildResponseSchema,
  formatGoal,
  formatInvalidResponse,
  formatToolResults,
  parseResponse,
} from "../src/protocol";
import { validateSchema } from "../src/schema";
import type { AnyTool } from "../src/types";

const addTodo: AnyTool = {
  name: "addTodo",
  description: "Add a todo item",
  parameters: {
    type: "object",
    properties: { title: { type: "string" } },
    required: ["title"],
    additionalProperties: false,
  },
  execute: () => undefined,
};

describe("buildInstructions", () => {
  it("describes the protocol and the tools", () => {
    const instructions = buildInstructions([addTodo], "  Be concise.  ");
    expect(instructions).toContain("answer ONLY with a single JSON object");
    expect(instructions).toContain('{"type":"calls"');
    expect(instructions).toContain('{"type":"final"');
    expect(instructions).toContain("- addTodo: Add a todo item");
    expect(instructions).toContain(JSON.stringify(addTodo.parameters));
    expect(instructions).toMatch(/Additional instructions:\nBe concise\.$/);
  });

  it("handles sessions without tools", () => {
    const instructions = buildInstructions([]);
    expect(instructions).toContain("no functions available");
    expect(instructions).not.toContain("Additional instructions");
  });
});

describe("buildResponseSchema", () => {
  const schema = buildResponseSchema([addTodo]);

  it("accepts calls of the tools and final answers", () => {
    expect(
      validateSchema(schema, {
        type: "calls",
        reasoning: "add it",
        calls: [{ name: "addTodo", arguments: { title: "milk" } }],
      }),
    ).toEqual([]);
    expect(validateSchema(schema, { type: "final", message: "done" })).toEqual(
      [],
    );
  });

  it("rejects unknown tools and invalid arguments", () => {
    expect(
      validateSchema(schema, {
        type: "calls",
        reasoning: "",
        calls: [{ name: "removeTodo", arguments: {} }],
      }),
    ).not.toEqual([]);
    expect(
      validateSchema(schema, {
        type: "calls",
        reasoning: "",
        calls: [{ name: "addTodo", arguments: { title: 1 } }],
      }),
    ).not.toEqual([]);
  });

  it("only allows final answers without tools", () => {
    const finalOnly = buildResponseSchema([]);
    expect(
      validateSchema(finalOnly, { type: "calls", reasoning: "", calls: [] }),
    ).not.toEqual([]);
    expect(validateSchema(finalOnly, { type: "final", message: "" })).toEqual(
      [],
    );
  });
});

describe("parseResponse", () => {
  it("parses a final answer", () => {
    expect(parseResponse('{"type":"final","message":"ok"}', [addTodo])).toEqual(
      { ok: true, response: { type: "final", message: "ok" } },
    );
  });

  it("parses calls wrapped in a markdown code fence and fills defaults", () => {
    const text = '```json\n{"type":"calls","calls":[{"name":"addTodo"}]}\n```';
    expect(parseResponse(text, [addTodo])).toEqual({
      ok: true,
      response: {
        type: "calls",
        reasoning: "",
        calls: [{ name: "addTodo", arguments: {} }],
      },
    });
  });

  it("does not validate the arguments of the calls", () => {
    const result = parseResponse(
      '{"type":"calls","reasoning":"","calls":[{"name":"addTodo","arguments":{"title":1}}]}',
      [addTodo],
    );
    expect(result.ok).toBe(true);
  });

  it.each([
    ["not json", "The answer is not valid JSON"],
    ["[1]", "The answer must be a JSON object"],
    ['{"type":"other"}', '$.type must be "calls" or "final"'],
    ['{"type":"final"}', "$.message is required"],
    ['{"type":"calls","calls":[]}', "$.calls must be a non empty array"],
    ['{"type":"calls","calls":[1]}', "$.calls[0] must be an object"],
    [
      '{"type":"calls","calls":[{"name":"nope"}]}',
      "$.calls[0].name must be one of addTodo",
    ],
    [
      '{"type":"calls","calls":[{"name":"addTodo","arguments":[]}]}',
      "$.calls[0].arguments must be an object",
    ],
  ])("rejects %s", (text, error) => {
    expect(parseResponse(text, [addTodo])).toEqual({ ok: false, error });
  });

  it("rejects calls when there are no tools", () => {
    expect(
      parseResponse('{"type":"calls","calls":[{"name":"addTodo"}]}', []),
    ).toEqual({ ok: false, error: 'No functions available, use type "final"' });
  });
});

describe("prompt formatters", () => {
  it("formats goal, results and invalid responses", () => {
    expect(formatGoal("add milk")).toContain("User goal: add milk");
    expect(
      formatToolResults([
        { name: "addTodo", arguments: {}, status: "success", result: 1 },
      ]),
    ).toContain('"status":"success"');
    expect(formatInvalidResponse("bad")).toContain(
      "Your previous answer was invalid: bad.",
    );
  });
});
