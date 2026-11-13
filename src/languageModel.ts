/**
 * Minimal typed subset of the built-in `LanguageModel` (Prompt API).
 * @see https://github.com/webmachinelearning/prompt-api
 */

export type LanguageModelAvailability =
  | "unavailable"
  | "downloadable"
  | "downloading"
  | "available";

export type LanguageModelMessageRole = "system" | "user" | "assistant";

export type LanguageModelMessage = {
  role: LanguageModelMessageRole;
  content: string;
};

export type LanguageModelExpected = {
  type: "text";
  languages?: string[];
};

export type LanguageModelDownloadProgressEvent = Event & {
  loaded: number;
};

export interface LanguageModelCreateMonitor extends EventTarget {
  addEventListener(
    type: "downloadprogress",
    listener: (event: LanguageModelDownloadProgressEvent) => void,
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
  ): void;
}

export type LanguageModelCreateCoreOptions = {
  temperature?: number;
  topK?: number;
  expectedInputs?: LanguageModelExpected[];
  expectedOutputs?: LanguageModelExpected[];
};

export type LanguageModelCreateOptions = LanguageModelCreateCoreOptions & {
  initialPrompts?: LanguageModelMessage[];
  signal?: AbortSignal;
  monitor?: (monitor: LanguageModelCreateMonitor) => void;
};

export type LanguageModelPromptOptions = {
  responseConstraint?: object;
  omitResponseConstraintInput?: boolean;
  signal?: AbortSignal;
};

export interface LanguageModelSession {
  prompt(
    input: string | LanguageModelMessage[],
    options?: LanguageModelPromptOptions,
  ): Promise<string>;
  destroy(): void;
  readonly inputUsage?: number;
  readonly inputQuota?: number;
}

export interface LanguageModelStatic {
  availability(
    options?: LanguageModelCreateCoreOptions,
  ): Promise<LanguageModelAvailability>;
  create(options?: LanguageModelCreateOptions): Promise<LanguageModelSession>;
}

/**
 * getLanguageModel returns the built-in `LanguageModel` global, or `undefined` when the browser
 * doesn't support the Prompt API.
 */
export const getLanguageModel = (): LanguageModelStatic | undefined =>
  (globalThis as { LanguageModel?: LanguageModelStatic }).LanguageModel;
