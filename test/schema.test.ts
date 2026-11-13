import { validateSchema } from "../src/schema";
import type { JSONSchema } from "../src/types";

const schema: JSONSchema = {
  type: "object",
  properties: {
    title: { type: "string", minLength: 1, maxLength: 5 },
    priority: { type: "integer", minimum: 1, maximum: 3 },
    status: { enum: ["todo", "done"] },
    tags: { type: "array", items: { type: "string" }, maxItems: 2 },
    kind: { const: "task" },
  },
  required: ["title"],
  additionalProperties: false,
};

describe("validateSchema", () => {
  it("accepts a valid value", () => {
    expect(
      validateSchema(schema, {
        title: "milk",
        priority: 2,
        status: "todo",
        tags: ["a"],
        kind: "task",
      }),
    ).toEqual([]);
  });

  it("reports required, additional and type errors", () => {
    expect(validateSchema(schema, { extra: 1 })).toEqual([
      "$.title is required",
      "$.extra is not allowed",
    ]);
    expect(validateSchema(schema, "nope")).toEqual([
      "$ must be of type object",
    ]);
  });

  it("reports constraint errors", () => {
    expect(
      validateSchema(schema, {
        title: "too long title",
        priority: 1.5,
        status: "doing",
        tags: ["a", 1, "c"],
        kind: "other",
      }),
    ).toEqual([
      "$.title must have at most 5 characters",
      "$.priority must be of type integer",
      '$.status must be one of "todo", "done"',
      "$.tags must have at most 2 items",
      "$.tags[1] must be of type string",
      '$.kind must be "task"',
    ]);
    expect(validateSchema(schema, { title: "", priority: 9 })).toEqual([
      "$.title must have at least 1 characters",
      "$.priority must be <= 3",
    ]);
  });

  it("supports number, null, minimum, minItems and additionalProperties schemas", () => {
    expect(validateSchema({ type: "number", minimum: 0 }, -1)).toEqual([
      "$ must be >= 0",
    ]);
    expect(validateSchema({ type: ["string", "null"] }, null)).toEqual([]);
    expect(validateSchema({ type: "array", minItems: 1 }, [])).toEqual([
      "$ must have at least 1 items",
    ]);
    expect(
      validateSchema(
        { type: "object", additionalProperties: { type: "number" } },
        { a: 1, b: "2" },
      ),
    ).toEqual(["$.b must be of type number"]);
  });

  it("supports anyOf and oneOf", () => {
    const anyOf: JSONSchema = {
      anyOf: [{ type: "string" }, { type: "number" }],
    };
    expect(validateSchema(anyOf, 1)).toEqual([]);
    expect(validateSchema(anyOf, true)).toEqual([
      "$ must match one of the allowed schemas",
    ]);
    const oneOf: JSONSchema = {
      oneOf: [{ type: "number" }, { type: "integer" }],
    };
    expect(validateSchema(oneOf, 1.5)).toEqual([]);
    expect(validateSchema(oneOf, 1)).toEqual([
      "$ must match exactly one of the allowed schemas",
    ]);
  });
});
