import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  markPopupClosed,
  markPopupReady,
  runCopyPipeline,
  setPopupDocumentId,
} from "../../src/background/copy-pipeline.js";
import { ERROR_CONTEXT } from "../../src/background/error-context.js";
import * as errorsModule from "../../src/background/errors.js";
import { getSinonChrome } from "../../src/dev/chrome-dev-mock.js";

const sinonChrome = getSinonChrome();

function getScriptingMock() {
  return (
    sinonChrome as unknown as {
      scripting: { executeScript: ReturnType<typeof vi.fn> };
    }
  ).scripting.executeScript as ReturnType<typeof vi.fn>;
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

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
    sinonWithScripting.scripting.executeScript.mockResolvedValue([{ result: true }]);

    sinonChrome.runtime.id = "test-extension";
    globalThis.chrome = sinonChrome as unknown as typeof chrome;
  });

  afterEach(() => {
    markPopupClosed();
    setPopupDocumentId(undefined);
    vi.useRealTimers();
    globalThis.chrome = originalChrome;
    vi.restoreAllMocks();
  });

  it("queues preview until the popup ready handshake and uses document targeting", async () => {
    const result = await runCopyPipeline(
      "Sample text",
      "Sample Title",
      "https://example.com",
      "popup",
      123,
    );

    expect(result).toContain("Sample text");
    expect(sinonChrome.runtime.sendMessage.called).toBe(false);

    setPopupDocumentId("doc-123");
    markPopupReady();
    await flushPromises();

    expect(sinonChrome.runtime.sendMessage.calledOnce).toBe(true);
    const call = sinonChrome.runtime.sendMessage.firstCall;
    expect(call?.args?.[0]).toBe("test-extension");
    expect(call?.args?.[1]).toEqual({
      type: "copied-text-preview",
      text: result,
    });
    expect((call?.args?.[2] as { documentId?: string })?.documentId).toBe("doc-123");
  });

  it("retries transient failures and records an error when sending ultimately fails", async () => {
    vi.useFakeTimers();
    const failure = new Error("send failed");
    sinonChrome.runtime.sendMessage.rejects(failure);
    const recordErrorSpy = vi.spyOn(errorsModule, "recordError").mockResolvedValue();

    await runCopyPipeline("Body", "Title", "https://example.com", "popup", 321);
    markPopupReady();

    await vi.runOnlyPendingTimersAsync();
    await vi.runOnlyPendingTimersAsync();
    await vi.runOnlyPendingTimersAsync();
    await flushPromises();

    expect(sinonChrome.runtime.sendMessage.callCount).toBeGreaterThanOrEqual(3);
    expect(recordErrorSpy).toHaveBeenCalledTimes(1);
    const [context, error] = recordErrorSpy.mock.calls[0];
    expect(context).toBe(ERROR_CONTEXT.NotifyPopupPreview);
    expect(error).toBe("send failed");
    expect(getScriptingMock().mock.calls.length).toBeGreaterThan(0);
  });

  it("falls back to copying when the popup closes before the preview is delivered", async () => {
    await runCopyPipeline("Body", "Title", "https://example.com", "popup", 222);

    expect(sinonChrome.runtime.sendMessage.called).toBe(false);

    markPopupClosed();
    await flushPromises();

    expect(getScriptingMock().mock.calls.length).toBeGreaterThan(0);
    expect(sinonChrome.runtime.sendMessage.called).toBe(false);
  });
});
