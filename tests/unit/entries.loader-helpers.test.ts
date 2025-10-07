import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createImportController,
  isRunningUnderVitest,
  LOADER_TIMEOUT_MS,
} from "../../src/entries/loader-helpers.js";

describe("entries/loader-helpers", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("imports modules through the configured importer", async () => {
    const controller = createImportController();
    controller.setModuleImporter(async (specifier) => ({ specifier }));

    await expect(controller.importWithTimeout("foo.js")).resolves.toEqual({ specifier: "foo.js" });
  });

  it("rejects when a module load exceeds the timeout", async () => {
    const realClearTimeout = globalThis.clearTimeout;
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout").mockImplementation(((
      callback: (...args: unknown[]) => void,
    ) => {
      callback();
      return 0 as unknown as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout);
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout").mockImplementation(((
      handle: Parameters<typeof clearTimeout>[0],
    ) => {
      return realClearTimeout(handle);
    }) as typeof clearTimeout);

    const controller = createImportController();
    controller.setModuleImporter(() => new Promise(() => {}));

    await expect(controller.importWithTimeout("slow-module.js")).rejects.toThrowError(
      /slow-module.js/,
    );

    setTimeoutSpy.mockRestore();
    clearTimeoutSpy.mockRestore();
  });

  it("detects Vitest execution via import.meta", () => {
    const meta = { vitest: true } as ImportMeta & { vitest?: boolean };
    expect(isRunningUnderVitest(meta)).toBe(true);
  });

  it("falls back to false when Vitest globals are absent", () => {
    const originalEnv = process.env.VITEST;
    const workerKey = "__vitest_worker__";
    const globalWorker = (globalThis as Record<string, unknown>)[workerKey];
    delete process.env.VITEST;
    delete (globalThis as Record<string, unknown>)[workerKey];

    try {
      expect(isRunningUnderVitest({} as ImportMeta)).toBe(false);
    } finally {
      if (originalEnv !== undefined) {
        process.env.VITEST = originalEnv;
      } else {
        delete process.env.VITEST;
      }
      if (globalWorker !== undefined) {
        (globalThis as Record<string, unknown>)[workerKey] = globalWorker;
      }
    }
  });
});
