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
    delete (sinonChrome.runtime as unknown as { lastError?: unknown }).lastError;
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

  it("executes clipboard-first injection path in the fallback helper", async () => {
    const recordErrorSpy = vi.spyOn(errorsModule, "recordError").mockResolvedValue();
    sinonChrome.runtime.sendMessage.rejects(new Error("fatal"));
    Object.defineProperty(sinonChrome.runtime, "lastError", {
      configurable: true,
      get: () => ({ message: "fatal" }),
    });

    const originalClipboard = navigator.clipboard;
    const originalExecCommand = document.execCommand;
    const writeSpy = vi.fn().mockResolvedValue(undefined);
    const execSpy = vi.fn();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: writeSpy },
    });
    document.execCommand = execSpy;

    getScriptingMock().mockImplementation(async ({ func }) => {
      const success = await func("payload");
      return [{ result: success }];
    });

    try {
      await runCopyPipeline("Body", "Title", "https://example.com", "popup", 111);
      markPopupReady();
      await flushPromises();

      expect(writeSpy).toHaveBeenCalledWith("payload");
      expect(execSpy).not.toHaveBeenCalled();
      expect(recordErrorSpy).toHaveBeenCalledWith(
        ERROR_CONTEXT.NotifyPopupPreview,
        expect.any(String),
      );
    } finally {
      if (originalClipboard) {
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: originalClipboard,
        });
      } else {
        delete (navigator as { clipboard?: unknown }).clipboard;
      }
      document.execCommand = originalExecCommand;
    }
  });

  it("executes textarea fallback when clipboard write fails", async () => {
    const recordErrorSpy = vi.spyOn(errorsModule, "recordError").mockResolvedValue();
    sinonChrome.runtime.sendMessage.rejects(new Error("fatal"));
    Object.defineProperty(sinonChrome.runtime, "lastError", {
      configurable: true,
      get: () => ({ message: "fatal" }),
    });

    const originalClipboard = navigator.clipboard;
    const originalExecCommand = document.execCommand;
    const writeSpy = vi.fn().mockRejectedValue(new Error("clipboard blocked"));
    const execSpy = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: writeSpy },
    });
    document.execCommand = execSpy;

    getScriptingMock().mockImplementation(async ({ func }) => {
      const success = await func("fallback payload");
      return [{ result: success }];
    });

    try {
      await runCopyPipeline("Body", "Title", "https://example.com", "popup", 222);
      markPopupReady();
      await flushPromises();

      expect(writeSpy).toHaveBeenCalled();
      expect(execSpy).toHaveBeenCalledWith("copy");
      expect(recordErrorSpy).toHaveBeenCalledWith(
        ERROR_CONTEXT.NotifyPopupPreview,
        expect.any(String),
      );
    } finally {
      if (originalClipboard) {
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: originalClipboard,
        });
      } else {
        delete (navigator as { clipboard?: unknown }).clipboard;
      }
      document.execCommand = originalExecCommand;
    }
  });

  it("requeues preview when retry fires while popup is not ready", async () => {
    const callbacks: Array<() => void> = [];
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout").mockImplementation((callback) => {
      callbacks.push(callback as () => void);
      return 123 as unknown as ReturnType<typeof setTimeout>;
    });
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout").mockImplementation(() => {});

    try {
      sinonChrome.runtime.sendMessage.rejects(new Error("Receiving end does not exist."));

      await runCopyPipeline("Body", "Title", "https://example.com", "popup", 333);
      markPopupReady();
      await flushPromises();

      expect(callbacks.length).toBe(1);

      markPopupClosed();
      callbacks[0]?.();

      expect(setTimeoutSpy).toHaveBeenCalled();
      expect(clearTimeoutSpy).toHaveBeenCalled();
    } finally {
      setTimeoutSpy.mockRestore();
      clearTimeoutSpy.mockRestore();
    }
  });
});
