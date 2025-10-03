import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runCopyPipeline } from "../../src/background/copy-pipeline.js";
import { ERROR_CONTEXT } from "../../src/background/error-context.js";
import * as errorsModule from "../../src/background/errors.js";
import { getSinonChrome } from "../../src/dev/chrome-dev-mock.js";

const sinonChrome = getSinonChrome();

describe("background/copy-pipeline", () => {
  const originalChrome = globalThis.chrome;

  beforeEach(() => {
    sinonChrome.reset();
    sinonChrome.runtime.sendMessage.resolves();
    sinonChrome.storage.sync.get.resolves({});
    const sinonWithScripting = sinonChrome as unknown as {
      scripting?: { executeScript: ReturnType<typeof vi.fn> };
    };
    if (!sinonWithScripting.scripting) {
      sinonWithScripting.scripting = { executeScript: vi.fn() };
    } else {
      sinonWithScripting.scripting.executeScript = vi.fn();
    }
    sinonWithScripting.scripting.executeScript.mockResolvedValue([]);
    globalThis.chrome = sinonChrome as unknown as typeof chrome;
  });

  afterEach(() => {
    globalThis.chrome = originalChrome;
    vi.restoreAllMocks();
  });

  it("formats selection and notifies popup when source is popup", async () => {
    (
      sinonChrome as unknown as {
        scripting: { executeScript: ReturnType<typeof vi.fn> };
      }
    ).scripting.executeScript.mockResolvedValue([{ result: true }]);

    const result = await runCopyPipeline(
      "Sample text",
      "Sample Title",
      "https://example.com",
      "popup",
      123,
    );

    expect(result).toContain("Sample text");
    expect(result).toContain("Sample Title");
    expect(result).toContain("https://example.com");
    expect(sinonChrome.runtime.sendMessage.calledOnce).toBe(true);
    expect(sinonChrome.runtime.sendMessage.firstCall?.args?.[0]).toEqual({
      type: "copied-text-preview",
      text: result,
    });
  });

  it("records an error when popup notification fails", async () => {
    const failure = new Error("send failed");
    sinonChrome.runtime.sendMessage.rejects(failure);
    const recordErrorSpy = vi.spyOn(errorsModule, "recordError").mockResolvedValue();

    (
      sinonChrome as unknown as {
        scripting: { executeScript: ReturnType<typeof vi.fn> };
      }
    ).scripting.executeScript.mockResolvedValue([{ result: true }]);

    await runCopyPipeline("Body", "Title", "https://example.com", "popup", 321);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(recordErrorSpy).toHaveBeenCalled();
    const [context, error] = recordErrorSpy.mock.calls[0];
    expect(context).toBe(ERROR_CONTEXT.NotifyPopupPreview);
    expect(error).toBe(failure);
  });
});
