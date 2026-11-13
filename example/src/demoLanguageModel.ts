import type {
  LanguageModelSession,
  LanguageModelStatic,
  ToolCall,
  ToolResult,
} from "browser-assistant";

type Call = [name: string, args: Record<string, unknown>];

const toCalls = (goal: string): Call[] => {
  const text = goal.trim();
  const add = text.match(/^add\s+(.+)$/i);
  if (add) {
    return add[1]
      .split(/,|\band\b/i)
      .map((title) => title.trim())
      .filter(Boolean)
      .map((title) => ["addTodo", { title }]);
  }
  const id = Number(text.match(/\d+/)?.[0]);
  if (/^(remove|delete)\b/i.test(text) && id) return [["removeTodo", { id }]];
  if (/^(complete|done|finish)\b/i.test(text) && id) {
    return [["toggleTodo", { id, done: true }]];
  }
  if (/^(undo|reopen)\b/i.test(text) && id) {
    return [["toggleTodo", { id, done: false }]];
  }
  if (/^clear\b/i.test(text)) return [["clearCompleted", {}]];
  if (/^(list|show)\b/i.test(text)) return [["listTodos", {}]];
  return [];
};

const summarize = (results: ToolResult[]) =>
  results
    .map((result) =>
      result.status === "success"
        ? `${result.name} succeeded: ${JSON.stringify(result.result)}`
        : `${result.name} ${result.status}: ${result.error}`,
    )
    .join("\n");

/**
 * demoLanguageModel is a rule based fake `LanguageModel`, used to try the example in browsers
 * without the Prompt API. It understands goals like "add milk and bread", "complete 1",
 * "remove 2", "clear" and "list", and answers with the same JSON protocol of the real model.
 */
export const demoLanguageModel: LanguageModelStatic = {
  availability: async () => "available",
  create: async (options) => {
    const instructions = options?.initialPrompts?.[0]?.content ?? "";
    const isAvailable = (name: string) => instructions.includes(`- ${name}:`);
    const session: LanguageModelSession = {
      prompt: async (input) => {
        await new Promise((resolve) => setTimeout(resolve, 300));
        const text = String(input);
        const results = text.match(/^Function results: (.*)$/m);
        if (results) {
          const parsed: ToolResult[] = JSON.parse(results[1]);
          return JSON.stringify({ type: "final", message: summarize(parsed) });
        }
        const goal = text.match(/^User goal: (.*)$/m)?.[1] ?? "";
        const calls: ToolCall[] = toCalls(goal).map(([name, args]) => ({
          name,
          arguments: args,
        }));
        if (calls.length === 0) {
          return JSON.stringify({
            type: "final",
            message:
              'Demo model: try "add milk and bread", "complete 1", "remove 1", "clear" or "list".',
          });
        }
        if (!calls.every((call) => isAvailable(call.name))) {
          return JSON.stringify({
            type: "final",
            message: "I can't do that with the functions available to me.",
          });
        }
        return JSON.stringify({
          type: "calls",
          reasoning: `Demo model mapped "${goal}" to ${calls.length} call(s).`,
          calls,
        });
      },
      destroy: () => {},
    };
    return session;
  },
};
