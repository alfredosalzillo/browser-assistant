import {
  getLanguageModel,
  type LanguageModelAvailability,
  type LanguageModelCreateCoreOptions,
  type LanguageModelStatic,
} from "./languageModel";

/**
 * isSupported returns `true` when a `LanguageModel` implementation is available.
 */
export const isSupported = (
  languageModel: LanguageModelStatic | undefined = getLanguageModel(),
): languageModel is LanguageModelStatic => languageModel !== undefined;

/**
 * availability returns the availability of the `LanguageModel`, `"unavailable"` when it is not
 * supported.
 */
export const availability = async (
  options?: LanguageModelCreateCoreOptions,
  languageModel: LanguageModelStatic | undefined = getLanguageModel(),
): Promise<LanguageModelAvailability> => {
  if (!isSupported(languageModel)) {
    return "unavailable";
  }
  return languageModel.availability(options);
};
