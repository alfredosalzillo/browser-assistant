/**
 * Re-exports and utilities for the built-in `LanguageModel` (Prompt API).
 * Types sourced from `@types/dom-chromium-ai`.
 * @see https://github.com/webmachinelearning/prompt-api
 */

/** Availability of the built-in LanguageModel. */
export type LanguageModelAvailability = Availability;

/** The monitor passed to the `monitor` callback during session creation. */
export type LanguageModelCreateMonitor = CreateMonitor;

/** Core creation options (no session-lifecycle fields). */
export type LanguageModelCreateCoreOptions =
  globalThis.LanguageModelCreateCoreOptions;

/** Full session creation options. */
export type LanguageModelCreateOptions = globalThis.LanguageModelCreateOptions;

/** Options for a single `prompt()` call. */
export type LanguageModelPromptOptions = globalThis.LanguageModelPromptOptions;

/**
 * Minimal interface for an active LanguageModel session.
 * This is a subset of the full `LanguageModel` class used by this library.
 */
export interface LanguageModelSession {
  prompt(
    input: LanguageModelPrompt,
    options?: LanguageModelPromptOptions,
  ): Promise<string>;
  destroy(): void;
}

/**
 * Minimal interface for the static side of the built-in `LanguageModel` global.
 * This is a subset of `typeof LanguageModel` used by this library.
 */
export interface LanguageModelStatic {
  availability(options?: LanguageModelCreateCoreOptions): Promise<Availability>;
  create(options?: LanguageModelCreateOptions): Promise<LanguageModelSession>;
}

/**
 * getLanguageModel returns the built-in `LanguageModel` global cast to `LanguageModelStatic`,
 * or `undefined` when the browser doesn't support the Prompt API.
 */
export const getLanguageModel = (): LanguageModelStatic | undefined =>
  (globalThis as { LanguageModel?: LanguageModelStatic }).LanguageModel;
