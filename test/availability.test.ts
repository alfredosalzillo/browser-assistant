import { availability, isSupported } from "../src/availability";
import { getLanguageModel } from "../src/languageModel";
import { createMockLanguageModel } from "./mocks/languageModel";

describe("availability", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is unsupported without a global LanguageModel", async () => {
    expect(getLanguageModel()).toBeUndefined();
    expect(isSupported()).toBe(false);
    await expect(availability()).resolves.toBe("unavailable");
  });

  it("uses the global LanguageModel", async () => {
    const languageModel = createMockLanguageModel([], "downloadable");
    vi.stubGlobal("LanguageModel", languageModel);
    expect(getLanguageModel()).toBe(languageModel);
    expect(isSupported()).toBe(true);
    await expect(availability()).resolves.toBe("downloadable");
  });

  it("accepts a custom LanguageModel", async () => {
    await expect(
      availability(undefined, createMockLanguageModel([], "downloading")),
    ).resolves.toBe("downloading");
  });
});
