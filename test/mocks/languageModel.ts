import type {
  LanguageModelAvailability,
  LanguageModelCreateOptions,
  LanguageModelPromptOptions,
  LanguageModelSession,
  LanguageModelStatic,
} from "../../src/languageModel";

export type ScriptedResponse = string | object;

export type MockLanguageModelSession = LanguageModelSession & {
  createOptions: LanguageModelCreateOptions;
  prompts: { input: string; options?: LanguageModelPromptOptions }[];
  destroyed: boolean;
};

export type MockLanguageModel = LanguageModelStatic & {
  sessions: MockLanguageModelSession[];
};

/**
 * createMockLanguageModel returns a fake `LanguageModel` answering every prompt with the next
 * scripted response.
 */
export const createMockLanguageModel = (
  responses: ScriptedResponse[] = [],
  availability: LanguageModelAvailability = "available",
): MockLanguageModel => {
  const queue = [...responses];
  const sessions: MockLanguageModelSession[] = [];
  return {
    sessions,
    availability: async () => availability,
    create: async (createOptions = {}) => {
      const session: MockLanguageModelSession = {
        createOptions,
        prompts: [],
        destroyed: false,
        prompt: async (input, options) => {
          session.prompts.push({ input: String(input), options });
          const next = queue.shift();
          if (next === undefined) throw new Error("No scripted response left");
          return typeof next === "string" ? next : JSON.stringify(next);
        },
        destroy: () => {
          session.destroyed = true;
        },
      };
      sessions.push(session);
      return session;
    },
  };
};
