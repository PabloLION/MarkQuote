import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LOADER_TIMEOUT_MS } from "../../src/entries/loader-helpers.js";

const originalChrome: typeof chrome | undefined = globalThis.chrome;

describe("entries/options-loader", () => {
  beforeEach(() => {
    delete (globalThis as { chrome?: typeof chrome }).chrome;
    document.body.innerHTML = "";
  });

  afterEach(() => {
    if (originalChrome) {
      (globalThis as { chrome?: typeof chrome }).chrome = originalChrome;
    } else {
      delete (globalThis as { chrome?: typeof chrome }).chrome;
    }
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("loads the dev entry when running outside an extension context", async () => {
    const importer = vi.fn().mockResolvedValue(undefined);

    await vi.resetModules();
    const module = await import("../../src/entries/options-loader.js");
    module.__setOptionsModuleImporter(importer);
    await module.loadOptionsModule();

    expect(importer).toHaveBeenCalledWith("/src/surfaces/options/main.ts");
  });

  it("loads the packaged bundle via chrome.runtime when inside the extension", async () => {
    const importer = vi.fn().mockResolvedValue(undefined);
    const getUrl = vi.fn().mockReturnValue("chrome-extension://id/options.js");

    await vi.resetModules();
    globalThis.chrome = {
      runtime: {
        id: "id",
        getURL: getUrl,
      },
    } as unknown as typeof chrome;

    const module = await import("../../src/entries/options-loader.js");
    module.__setOptionsModuleImporter(importer);
    await module.loadOptionsModule();

    expect(getUrl).toHaveBeenCalledWith("options.js");
    expect(importer).toHaveBeenCalledWith("chrome-extension://id/options.js");
  });

  it("renders inline error text when the status element exists", async () => {
    const status = document.createElement("div");
    status.id = "status";
    document.body.append(status);

    const module = await import("../../src/entries/options-loader.js");
    module.renderOptionsError(new Error("boom"));

    expect(status.textContent).toContain("failed to load");
    expect(status.getAttribute("role")).toBe("alert");
  });

  it("adds a fallback banner when the status element is missing", async () => {
    const module = await import("../../src/entries/options-loader.js");
    module.renderOptionsError("fatal");

    const fallback = document.body.firstElementChild as HTMLElement | null;
    expect(fallback?.textContent).toContain("failed to load");
    expect(fallback?.style.border).toContain("solid");
  });

  it("reports bootstrap failures via renderOptionsError", async () => {
    const importer = vi.fn().mockRejectedValue(new Error("fatal"));

    const status = document.createElement("div");
    status.id = "status";
    document.body.append(status);

    await vi.resetModules();
    const module = await import("../../src/entries/options-loader.js");
    module.__setOptionsModuleImporter(importer);

    await module.bootstrapOptions();

    expect(status.textContent).toContain("failed to load");
  });

  it("fails fast when module loading exceeds the timeout", async () => {
    vi.useFakeTimers();

    try {
      const importer = vi.fn(() => new Promise(() => {}));

      await vi.resetModules();
      const module = await import("../../src/entries/options-loader.js");
      module.__setOptionsModuleImporter(importer);

      const loadPromise = module.loadOptionsModule();
      const expectation = expect(loadPromise).rejects.toThrow("Module load timed out");

      await vi.advanceTimersByTimeAsync(LOADER_TIMEOUT_MS);
      await expectation;
    } finally {
      vi.useRealTimers();
    }
  });

  it("supports concurrent load requests without leaving timers dangling", async () => {
    const importer = vi.fn(() => Promise.resolve(undefined));

    await vi.resetModules();
    const module = await import("../../src/entries/options-loader.js");
    module.__setOptionsModuleImporter(importer);

    await Promise.all([module.loadOptionsModule(), module.loadOptionsModule()]);

    expect(importer).toHaveBeenCalledTimes(2);
  });
});
