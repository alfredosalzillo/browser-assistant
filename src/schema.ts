import type { JSONSchema, JSONSchemaType } from "./types";

const typeOf = (value: unknown): JSONSchemaType => {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "number") {
    return Number.isInteger(value) ? "integer" : "number";
  }
  return typeof value as JSONSchemaType;
};

const matchesType = (value: unknown, type: JSONSchemaType) => {
  const actual = typeOf(value);
  if (type === "number") return actual === "number" || actual === "integer";
  return actual === type;
};

const isEqual = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeOf(value) === "object";

/**
 * validateSchema validates a value against a subset of JSON Schema and returns the list of the
 * errors, an empty list when the value is valid.
 *
 * Supported keywords: type, enum, const, properties, required, additionalProperties, items,
 * minItems, maxItems, minLength, maxLength, minimum, maximum, anyOf, oneOf.
 */
export const validateSchema = (
  schema: JSONSchema,
  value: unknown,
  path = "$",
): string[] => {
  const errors: string[] = [];

  if (schema.anyOf) {
    const matches = schema.anyOf.some(
      (option) => validateSchema(option, value, path).length === 0,
    );
    if (!matches) errors.push(`${path} must match one of the allowed schemas`);
  }

  if (schema.oneOf) {
    const matches = schema.oneOf.filter(
      (option) => validateSchema(option, value, path).length === 0,
    ).length;
    if (matches !== 1) {
      errors.push(`${path} must match exactly one of the allowed schemas`);
    }
  }

  if (schema.type) {
    const types = [schema.type].flat();
    if (!types.some((type) => matchesType(value, type))) {
      errors.push(`${path} must be of type ${types.join(" | ")}`);
      return errors;
    }
  }

  if ("const" in schema && !isEqual(schema.const, value)) {
    errors.push(`${path} must be ${JSON.stringify(schema.const)}`);
  }

  if (schema.enum && !schema.enum.some((option) => isEqual(option, value))) {
    errors.push(
      `${path} must be one of ${schema.enum.map((option) => JSON.stringify(option)).join(", ")}`,
    );
  }

  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(`${path} must have at least ${schema.minLength} characters`);
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push(`${path} must have at most ${schema.maxLength} characters`);
    }
  }

  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push(`${path} must be >= ${schema.minimum}`);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push(`${path} must be <= ${schema.maximum}`);
    }
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push(`${path} must have at least ${schema.minItems} items`);
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push(`${path} must have at most ${schema.maxItems} items`);
    }
    const { items } = schema;
    if (items) {
      value.forEach((item, index) => {
        errors.push(...validateSchema(items, item, `${path}[${index}]`));
      });
    }
  }

  if (isPlainObject(value)) {
    const properties = schema.properties ?? {};
    for (const key of schema.required ?? []) {
      if (!(key in value)) errors.push(`${path}.${key} is required`);
    }
    for (const [key, propertyValue] of Object.entries(value)) {
      const propertySchema = properties[key];
      if (propertySchema) {
        errors.push(
          ...validateSchema(propertySchema, propertyValue, `${path}.${key}`),
        );
      } else if (schema.additionalProperties === false) {
        errors.push(`${path}.${key} is not allowed`);
      } else if (typeof schema.additionalProperties === "object") {
        errors.push(
          ...validateSchema(
            schema.additionalProperties,
            propertyValue,
            `${path}.${key}`,
          ),
        );
      }
    }
  }

  return errors;
};
