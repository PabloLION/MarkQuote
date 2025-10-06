import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getLastPreviewError,
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

function resetRuntimeLastError(): void {
  const runtime = sinonChrome.runtime as unknown as { lastError?: unknown };
  const descriptor = Object.getOwnPropertyDescriptor(runtime, "lastError");
  if (descriptor) {
    Object.defineProperty(runtime, "lastError", {
      configurable: true,
      writable: true,
      value: undefined,
    });
  } else {
    runtime.lastError = undefined;
  }
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
    resetRuntimeLastError();
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

  it("falls back to broadcast delivery when the popup document id is missing", async () => {
    const result = await runCopyPipeline("Broadcast", "Title", "https://example.com", "popup", 321);

    markPopupReady();
    await flushPromises();

    expect(sinonChrome.runtime.sendMessage.calledOnce).toBe(true);
    const call = sinonChrome.runtime.sendMessage.firstCall;
    expect(call?.args?.[0]).toEqual({
      type: "copied-text-preview",
      text: result,
    });
    expect(call?.args?.length).toBe(1);
  });

  it("uses the captured document id when the runtime getter mutates state", async () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(sinonChrome.runtime, "id");
    Object.defineProperty(sinonChrome.runtime, "id", {
      configurable: true,
      get: () => {
        setPopupDocumentId(undefined);
        return "test-extension";
      },
    });

    try {
      await runCopyPipeline("Body", "Title", "https://example.com", "popup", 654);
      setPopupDocumentId("doc-stable");
      markPopupReady();
      await flushPromises();

      expect(sinonChrome.runtime.sendMessage.calledOnce).toBe(true);
      const call = sinonChrome.runtime.sendMessage.firstCall;
      expect((call?.args?.[2] as { documentId?: string })?.documentId).toBe("doc-stable");
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(sinonChrome.runtime, "id", originalDescriptor);
      } else {
        Object.defineProperty(sinonChrome.runtime, "id", {
          configurable: true,
          value: "test-extension",
        });
      }
    }
  });

  it("sends preview without document targeting when runtime id is missing", async () => {
    const originalId = sinonChrome.runtime.id;
    sinonChrome.runtime.id = undefined as unknown as string;

    const result = await runCopyPipeline(
      "Sample text",
      "Sample Title",
      "https://example.com",
      "popup",
      999,
    );

    setPopupDocumentId("doc-999");
    markPopupReady();
    await flushPromises();

    expect(sinonChrome.runtime.sendMessage.calledOnce).toBe(true);
    const call = sinonChrome.runtime.sendMessage.firstCall;
    expect(call?.args?.[0]).toEqual({
      type: "copied-text-preview",
      text: result,
    });
    sinonChrome.runtime.id = originalId;
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

  it("records preview error and fallback copy failure", async () => {
    vi.useFakeTimers();
    const recordErrorSpy = vi.spyOn(errorsModule, "recordError").mockResolvedValue();
    sinonChrome.runtime.sendMessage.callsFake(async () => {
      throw new Error("fatal");
    });
    Object.defineProperty(sinonChrome.runtime, "lastError", {
      configurable: true,
      get: () => ({ message: "fatal error" }),
    });
    getScriptingMock().mockRejectedValueOnce(new Error("inject failed"));

    await runCopyPipeline("Body", "Title", "https://example.com", "popup", 999);
    markPopupReady();

    await vi.runOnlyPendingTimersAsync();
    await flushPromises();

    const contexts = recordErrorSpy.mock.calls.map(([context]) => context);
    expect(contexts).toContain(ERROR_CONTEXT.PopupClipboardFallback);
    expect(getLastPreviewError()).toBeUndefined();
    expect(getScriptingMock().mock.calls.length).toBeGreaterThan(0);
    vi.useRealTimers();
  });

  it("clears pending preview retries when popup closes and reopens quickly", async () => {
    vi.useFakeTimers();
    const recordErrorSpy = vi.spyOn(errorsModule, "recordError").mockResolvedValue();
    const sendMessageStub = sinonChrome.runtime.sendMessage;
    sendMessageStub.onFirstCall().rejects(new Error("transient"));
    sendMessageStub.onSecondCall().resolves();

    await runCopyPipeline("Body", "Title", "https://example.com", "popup", 555);
    markPopupReady();
    await flushPromises();

    expect(vi.getTimerCount()).toBeGreaterThan(0);

    markPopupClosed();
    expect(vi.getTimerCount()).toBe(0);

    await vi.runAllTimers();
    expect(sendMessageStub.callCount).toBe(1);

    await runCopyPipeline("Body two", "Next", "https://example.com/next", "popup", 556);
    markPopupReady();
    await flushPromises();

    expect(sendMessageStub.callCount).toBe(2);

    await vi.runAllTimers();
    expect(sendMessageStub.callCount).toBe(2);
    expect(recordErrorSpy).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("captures last formatted preview in e2e mode", async () => {
    const originalEnv = process.env.VITE_E2E;
    process.env.VITE_E2E = "true";
    vi.resetModules();

    try {
      const module = await vi.importActual<typeof import("../../src/background/copy-pipeline.js")>(
        "../../src/background/copy-pipeline.js",
      );
      const {
        runCopyPipeline: e2eRun,
        getLastFormattedPreview: e2eGetPreview,
        getLastPreviewError: e2eGetError,
        markPopupClosed: e2eClose,
        markPopupReady: e2eReady,
        setLastPreviewError: e2eSetError,
      } = module;

      await e2eRun("E2E body", "E2E title", "https://example.com", "popup", 1);
      e2eReady();
      await flushPromises();
      expect(e2eGetPreview()).toContain("E2E body");
      expect(e2eGetError()).toBeUndefined();

      sinonChrome.runtime.sendMessage.resetBehavior();
      sinonChrome.runtime.sendMessage.resetHistory?.();
      sinonChrome.runtime.sendMessage.rejects(new Error("fatal"));
      Object.defineProperty(sinonChrome.runtime, "lastError", {
        configurable: true,
        get: () => ({ message: "fatal" }),
      });
      await e2eRun("Failed body", "Failed title", "https://example.com", "popup", 2);
      e2eReady();
      await flushPromises();
      expect(e2eGetError()).toBe("fatal");

      e2eClose();
      e2eSetError("manual");
      expect(e2eGetError()).toBe("manual");
      e2eSetError(undefined);
    } finally {
      process.env.VITE_E2E = originalEnv;
      vi.resetModules();
    }
  });

  it("returns early when popup becomes ready without queued preview", () => {
    markPopupReady();
    expect(sinonChrome.runtime.sendMessage.called).toBe(false);
  });

  it("clears pending retry timer when a new popup preview is queued", async () => {
    vi.useFakeTimers();
    const transientError = new Error("Receiving end does not exist.");
    sinonChrome.runtime.sendMessage.onFirstCall().rejects(transientError);
    sinonChrome.runtime.sendMessage.onSecondCall().resolves(undefined);
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");

    try {
      await runCopyPipeline("Body", "Title", "https://example.com", "popup", 123);
      markPopupReady();

      await flushPromises();

      expect(setTimeoutSpy).toHaveBeenCalled();
      expect(vi.getTimerCount()).toBeGreaterThan(0);

      await runCopyPipeline("Body 2", "Title", "https://example.com", "popup", 123);

      expect(clearTimeoutSpy).toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      clearTimeoutSpy.mockRestore();
      setTimeoutSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it("clears retry timer when popup closes before retry completes", async () => {
    vi.useFakeTimers();
    sinonChrome.runtime.sendMessage.rejects(new Error("Receiving end does not exist."));
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");

    try {
      await runCopyPipeline("Body", "Title", "https://example.com", "popup", 55);
      markPopupReady();
      await flushPromises();

      expect(vi.getTimerCount()).toBeGreaterThan(0);

      markPopupClosed();

      expect(clearTimeoutSpy).toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      clearTimeoutSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it("records fallback error when script injection returns false", async () => {
    const recordErrorSpy = vi.spyOn(errorsModule, "recordError").mockResolvedValue();
    sinonChrome.runtime.sendMessage.rejects(new Error("fatal"));
    Object.defineProperty(sinonChrome.runtime, "lastError", {
      configurable: true,
      get: () => ({ message: "fatal" }),
    });
    const scriptingMock = getScriptingMock();
    scriptingMock.mockResolvedValueOnce([{ result: false }]);

    await runCopyPipeline("Body", "Title", "https://example.com", "popup", 88);
    markPopupReady();
    await flushPromises();

    expect(recordErrorSpy).toHaveBeenCalledWith(
      ERROR_CONTEXT.PopupClipboardFallback,
      "Failed to copy via fallback",
      { tabId: 88 },
    );
  });

  it("records fallback error when script injection throws", async () => {
    const recordErrorSpy = vi.spyOn(errorsModule, "recordError").mockResolvedValue();
    sinonChrome.runtime.sendMessage.rejects(new Error("fatal"));
    Object.defineProperty(sinonChrome.runtime, "lastError", {
      configurable: true,
      get: () => ({ message: "fatal" }),
    });
    getScriptingMock().mockRejectedValueOnce(new Error("no injection"));

    await runCopyPipeline("Body", "Title", "https://example.com", "popup", 77);
    markPopupReady();
    await flushPromises();

    const contexts = recordErrorSpy.mock.calls.map(([context]) => context);
    expect(
      contexts.filter((context) => context === ERROR_CONTEXT.PopupClipboardFallback).length,
    ).toBeGreaterThan(0);
  });

  it("records fallback error when tab id is invalid", async () => {
    const recordErrorSpy = vi.spyOn(errorsModule, "recordError").mockResolvedValue();
    sinonChrome.runtime.sendMessage.rejects(new Error("fatal"));
    Object.defineProperty(sinonChrome.runtime, "lastError", {
      configurable: true,
      get: () => ({ message: "fatal" }),
    });

    await runCopyPipeline("Body", "Title", "https://example.com", "popup", Number.NaN);
    markPopupReady();
    await flushPromises();

    expect(getScriptingMock().mock.calls.length).toBe(0);
    expect(recordErrorSpy).toHaveBeenCalledWith(
      ERROR_CONTEXT.PopupClipboardFallback,
      "Invalid tabId for fallback copy",
      { tabId: Number.NaN },
    );
  });

  it("requeues preview when retry fires while popup is not ready", async () => {
    const callbacks: Array<() => void> = [];
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout").mockImplementation((callback) => {
      callbacks.push(callback as () => void);
      return 123 as unknown as ReturnType<typeof setTimeout>;
    });
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout").mockImplementation(() => {});

    try {
      const transientError = new Error("Receiving end does not exist.");
      sinonChrome.runtime.sendMessage.onFirstCall().callsFake(async () => {
        Object.defineProperty(sinonChrome.runtime, "lastError", {
          configurable: true,
          get: () => ({ message: transientError.message }),
        });
        throw transientError;
      });
      sinonChrome.runtime.sendMessage.onSecondCall().resolves(undefined);

      await runCopyPipeline("Body", "Title", "https://example.com", "popup", 333);
      setPopupDocumentId("doc-active");
      markPopupReady();
      await flushPromises();

      expect(callbacks.length).toBe(1);

      markPopupClosed();
      callbacks[0]?.();

      expect(sinonChrome.runtime.sendMessage.callCount).toBe(1);

      Object.defineProperty(sinonChrome.runtime, "lastError", {
        configurable: true,
        value: undefined,
        writable: true,
      });

      setPopupDocumentId("doc-reopen");
      markPopupReady();
      await flushPromises();

      expect(sinonChrome.runtime.sendMessage.callCount).toBe(2);

      expect(setTimeoutSpy).toHaveBeenCalled();
      expect(clearTimeoutSpy).toHaveBeenCalled();
    } finally {
      setTimeoutSpy.mockRestore();
      clearTimeoutSpy.mockRestore();
    }
  });

  it("clears pending retry timer when popup becomes ready", async () => {
    sinonChrome.runtime.sendMessage.rejects(new Error("Receiving end does not exist."));
    const realSetTimeout = globalThis.setTimeout;
    const realClearTimeout = globalThis.clearTimeout;
    const scheduledTimers: Array<ReturnType<typeof setTimeout>> = [];
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout").mockImplementation(((
      ...args: Parameters<typeof setTimeout>
    ) => {
      const id = realSetTimeout(...args);
      scheduledTimers.push(id);
      return id;
    }) as typeof setTimeout);
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout").mockImplementation(((
      handle: Parameters<typeof clearTimeout>[0],
    ) => {
      return realClearTimeout(handle);
    }) as typeof clearTimeout);

    try {
      await runCopyPipeline("Body", "Title", "https://example.com", "popup", 444);
      markPopupReady();
      await flushPromises();
      expect(setTimeoutSpy).toHaveBeenCalled();

      markPopupReady();
      expect(clearTimeoutSpy).toHaveBeenCalledWith(scheduledTimers[0]);
    } finally {
      clearTimeoutSpy.mockRestore();
      setTimeoutSpy.mockRestore();
      for (const id of scheduledTimers) {
        clearTimeout(id);
      }
    }
  });

  it("logs when fallback error persistence fails", async () => {
    vi.useFakeTimers();
    const persistError = new Error("persist failed");
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(errorsModule, "recordError").mockImplementation(async (context, _error, _extra) => {
      if (context === ERROR_CONTEXT.PopupClipboardFallback) {
        throw persistError;
      }
      return Promise.resolve();
    });
    sinonChrome.runtime.sendMessage.rejects(new Error("fatal"));
    Object.defineProperty(sinonChrome.runtime, "lastError", {
      configurable: true,
      get: () => ({ message: "fatal" }),
    });
    getScriptingMock().mockRejectedValueOnce(new Error("inject failed"));

    await runCopyPipeline("Body", "Title", "https://example.com", "popup", 777);
    markPopupReady();

    await vi.runOnlyPendingTimersAsync();
    await flushPromises();

    expect(consoleSpy).toHaveBeenCalledWith(
      "[MarkQuote] Failed to record popup fallback error",
      persistError,
      expect.objectContaining({ tabId: 777, originalError: expect.any(Error) }),
    );

    consoleSpy.mockRestore();
    vi.useRealTimers();
  });
});
