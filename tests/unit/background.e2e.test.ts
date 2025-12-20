import chrome from "sinon-chrome";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ERROR_CONTEXT, type ErrorContext } from "../../src/background/error-context.js";
import type { CopySource } from "../../src/background/types.js";

const flushMicrotasks = async () => {
  await new Promise((resolve) => setImmediate(resolve));
};

let handleE2eMessage: typeof import("../../src/background/e2e.js").handleE2eMessage;
let updateHotkeyDiagnostics: typeof import("../../src/background/e2e.js").updateHotkeyDiagnostics;
let getHotkeyDiagnostics: typeof import("../../src/background/e2e.js").getHotkeyDiagnostics;
let resetHotkeyDiagnosticsFn: typeof import("../../src/background/e2e.js").resetHotkeyDiagnostics;
let consumeForcedHotkeyPinnedState: typeof import("../../src/background/e2e.js").consumeForcedHotkeyPinnedState;
let runCopyPipeline: typeof import("../../src/background/copy-pipeline.js").runCopyPipeline;
let getLastFormattedPreview: typeof import("../../src/background/copy-pipeline.js").getLastFormattedPreview;
let getLastPreviewError: typeof import("../../src/background/copy-pipeline.js").getLastPreviewError;
let setLastPreviewError: typeof import("../../src/background/copy-pipeline.js").setLastPreviewError;
let resetE2ePreviewState: typeof import("../../src/background/copy-pipeline.js").resetE2ePreviewState;
const originalE2E = process.env.VITE_E2E;

describe("handleE2eMessage", () => {
  beforeEach(async () => {
    chrome.reset();
    // @ts-expect-error – vitest environment provides globals but we override for sinon-chrome.
    globalThis.chrome = chrome;
    process.env.VITE_E2E = "true";
    vi.resetModules();
    ({
      handleE2eMessage,
      updateHotkeyDiagnostics,
      getHotkeyDiagnostics,
      resetHotkeyDiagnostics: resetHotkeyDiagnosticsFn,
      consumeForcedHotkeyPinnedState,
    } = await import("../../src/background/e2e.js"));
    ({
      runCopyPipeline,
      getLastFormattedPreview,
      getLastPreviewError,
      setLastPreviewError,
      resetE2ePreviewState,
    } = await import("../../src/background/copy-pipeline.js"));
  });

  afterEach(() => {
    process.env.VITE_E2E = originalE2E;
  });

  it("invokes the hotkey command handler", async () => {
    const tab = { id: 42 } as any;
    chrome.tabs.get.resolves(tab);

    const triggerCommand = vi.fn().mockResolvedValue(undefined);
    const sendResponse = vi.fn();

    const handled = handleE2eMessage({
      request: { type: "e2e:trigger-command", tabId: 42 },
      sender: { tab: undefined } as any,
      sendResponse,
      persistOptions: vi.fn(),
      recordError: vi.fn(),
      handleCopyRequest: vi.fn(),
      triggerCommand,
      getErrorLog: vi.fn(),
      clearErrorLog: vi.fn(),
      resetStorage: vi.fn(),
    });

    expect(handled).toBe(true);
    await flushMicrotasks();

    expect(triggerCommand).toHaveBeenCalledWith(tab);
    expect(sendResponse).toHaveBeenCalledWith({ ok: true });
  });

  it("triggers a context copy flow", async () => {
    const tab = { id: 8 } as any;
    chrome.tabs.get.resolves(tab);

    const handleCopyRequest = vi.fn().mockResolvedValue(undefined);
    const sendResponse = vi.fn();

    const handled = handleE2eMessage({
      request: { type: "e2e:context-copy", tabId: 8, source: "context-menu" satisfies CopySource },
      sender: { tab: undefined } as any,
      sendResponse,
      persistOptions: vi.fn(),
      recordError: vi.fn(),
      handleCopyRequest,
      triggerCommand: vi.fn(),
      getErrorLog: vi.fn(),
      clearErrorLog: vi.fn(),
      resetStorage: vi.fn(),
    });

    expect(handled).toBe(true);
    await flushMicrotasks();

    expect(handleCopyRequest).toHaveBeenCalledWith(tab, "context-menu");
    expect(sendResponse).toHaveBeenCalledWith({ ok: true });
  });

  it("returns stored errors", async () => {
    const sendResponse = vi.fn();
    const getErrorLog = vi
      .fn()
      .mockResolvedValue([
        { message: "Test", context: ERROR_CONTEXT.InjectSelectionScript, timestamp: 1 },
      ]);

    const handled = handleE2eMessage({
      request: { type: "e2e:get-error-log" },
      sender: { tab: undefined } as any,
      sendResponse,
      persistOptions: vi.fn(),
      recordError: vi.fn(),
      handleCopyRequest: vi.fn(),
      triggerCommand: vi.fn(),
      getErrorLog,
      clearErrorLog: vi.fn(),
      resetStorage: vi.fn(),
    });

    expect(handled).toBe(true);
    await flushMicrotasks();

    expect(sendResponse).toHaveBeenCalledWith({
      errors: [{ message: "Test", context: ERROR_CONTEXT.InjectSelectionScript, timestamp: 1 }],
    });
  });

  it("clears the error log", async () => {
    const sendResponse = vi.fn();
    const clearErrorLog = vi.fn().mockResolvedValue(undefined);

    const handled = handleE2eMessage({
      request: { type: "e2e:clear-error-log" },
      sender: { tab: undefined } as any,
      sendResponse,
      persistOptions: vi.fn(),
      recordError: vi.fn(),
      handleCopyRequest: vi.fn(),
      triggerCommand: vi.fn(),
      getErrorLog: vi.fn(),
      clearErrorLog,
      resetStorage: vi.fn(),
    });

    expect(handled).toBe(true);
    await flushMicrotasks();

    expect(clearErrorLog).toHaveBeenCalled();
    expect(sendResponse).toHaveBeenCalledWith({ ok: true });
  });

  it("rejects invalid error contexts when seeding", () => {
    const sendResponse = vi.fn();

    const handled = handleE2eMessage({
      request: { type: "e2e:seed-error", context: "unknown" },
      sender: { tab: undefined } as any,
      sendResponse,
      persistOptions: vi.fn(),
      recordError: vi.fn(),
      handleCopyRequest: vi.fn(),
      triggerCommand: vi.fn(),
      getErrorLog: vi.fn(),
      clearErrorLog: vi.fn(),
      resetStorage: vi.fn(),
    });

    expect(handled).toBe(false);
    expect(sendResponse).toHaveBeenCalledWith({
      ok: false,
      error: "Invalid error context supplied.",
    });
  });

  it("records seeded errors", async () => {
    const sendResponse = vi.fn();
    const recordError = vi.fn().mockResolvedValue(undefined);

    const handled = handleE2eMessage({
      request: {
        type: "e2e:seed-error",
        context: ERROR_CONTEXT.InjectSelectionScript,
        message: "Boom",
      },
      sender: { tab: undefined } as any,
      sendResponse,
      persistOptions: vi.fn(),
      recordError,
      handleCopyRequest: vi.fn(),
      triggerCommand: vi.fn(),
      getErrorLog: vi.fn(),
      clearErrorLog: vi.fn(),
      resetStorage: vi.fn(),
    });

    expect(handled).toBe(true);
    await flushMicrotasks();

    expect(recordError).toHaveBeenCalledWith(ERROR_CONTEXT.InjectSelectionScript, "Boom");
    expect(sendResponse).toHaveBeenCalledWith({ ok: true });
  });

  it("resets extension storage", async () => {
    const sendResponse = vi.fn();
    const resetStorage = vi.fn().mockResolvedValue(undefined);

    const handled = handleE2eMessage({
      request: { type: "e2e:reset-storage" },
      sender: { tab: undefined } as any,
      sendResponse,
      persistOptions: vi.fn(),
      recordError: vi.fn(),
      handleCopyRequest: vi.fn(),
      triggerCommand: vi.fn(),
      getErrorLog: vi.fn(),
      clearErrorLog: vi.fn(),
      resetStorage,
    });

    expect(handled).toBe(true);
    await flushMicrotasks();

    expect(resetStorage).toHaveBeenCalled();
    expect(sendResponse).toHaveBeenCalledWith({ ok: true });
  });

  it("resets the preview state via message", async () => {
    resetE2ePreviewState();
    await runCopyPipeline("Example markdown", "Example title", "https://example.com", "popup");
    setLastPreviewError("previous error");

    expect(getLastFormattedPreview()).not.toBe("");
    expect(getLastPreviewError()).toBe("previous error");

    const sendResponse = vi.fn();
    const handled = handleE2eMessage({
      request: { type: "e2e:reset-preview-state" },
      sender: { tab: undefined } as any,
      sendResponse,
      persistOptions: vi.fn(),
      recordError: vi.fn(),
      handleCopyRequest: vi.fn(),
      triggerCommand: vi.fn(),
      getErrorLog: vi.fn(),
      clearErrorLog: vi.fn(),
      resetStorage: vi.fn(),
    });

    expect(handled).toBe(true);
    await flushMicrotasks();

    expect(sendResponse).toHaveBeenCalledWith({ ok: true });
    expect(getLastFormattedPreview()).toBe("");
    expect(getLastPreviewError()).toBeUndefined();
  });

  it("resets hotkey diagnostics via message", async () => {
    resetHotkeyDiagnosticsFn();
    updateHotkeyDiagnostics({
      eventTabId: 77,
      resolvedTabId: 77,
      stubSelectionUsed: true,
      injectionAttempted: true,
      injectionSucceeded: false,
      injectionError: "failed",
    });

    const setPinnedResponse = vi.fn();
    const setPinnedHandled = handleE2eMessage({
      request: { type: "e2e:set-hotkey-pinned", pinned: true },
      sender: { tab: undefined } as any,
      sendResponse: setPinnedResponse,
      persistOptions: vi.fn(),
      recordError: vi.fn(),
      handleCopyRequest: vi.fn(),
      triggerCommand: vi.fn(),
      getErrorLog: vi.fn(),
      clearErrorLog: vi.fn(),
      resetStorage: vi.fn(),
    });

    expect(setPinnedHandled).toBe(true);
    await flushMicrotasks();
    expect(setPinnedResponse).toHaveBeenCalledWith({ ok: true });

    const sendResponse = vi.fn();
    const handled = handleE2eMessage({
      request: { type: "e2e:reset-hotkey-diagnostics" },
      sender: { tab: undefined } as any,
      sendResponse,
      persistOptions: vi.fn(),
      recordError: vi.fn(),
      handleCopyRequest: vi.fn(),
      triggerCommand: vi.fn(),
      getErrorLog: vi.fn(),
      clearErrorLog: vi.fn(),
      resetStorage: vi.fn(),
    });

    expect(handled).toBe(true);
    await flushMicrotasks();

    expect(sendResponse).toHaveBeenCalledWith({ ok: true });
    const diagnostics = getHotkeyDiagnostics();
    expect(diagnostics.eventTabId).toBeNull();
    expect(diagnostics.resolvedTabId).toBeNull();
    expect(diagnostics.stubSelectionUsed).toBe(false);
    expect(diagnostics.injectionAttempted).toBe(false);
    expect(diagnostics.injectionSucceeded).toBeNull();
    expect(diagnostics.injectionError).toBeNull();
    expect(consumeForcedHotkeyPinnedState()).toBeUndefined();
  });
  it("returns the active tab metadata", async () => {
    chrome.tabs.query.resolves([
      { id: 9, windowId: 100, url: "https://example.com", title: "Example" },
    ]);
    const sendResponse = vi.fn();

    const handled = handleE2eMessage({
      request: { type: "e2e:get-active-tab" },
      sender: { tab: undefined } as any,
      sendResponse,
      persistOptions: vi.fn(),
      recordError: vi.fn(),
      handleCopyRequest: vi.fn(),
      triggerCommand: vi.fn(),
      getErrorLog: vi.fn(),
      clearErrorLog: vi.fn(),
      resetStorage: vi.fn(),
    });

    expect(handled).toBe(true);
    await flushMicrotasks();

    expect(sendResponse).toHaveBeenCalledWith({
      id: 9,
      windowId: 100,
      url: "https://example.com",
      title: "Example",
    });
  });

  it("finds a tab by URL pattern", async () => {
    chrome.tabs.query.resolves([
      { id: 7, windowId: 2, url: "https://example.com/article", title: "Example" },
    ]);
    const sendResponse = vi.fn();

    const handled = handleE2eMessage({
      request: { type: "e2e:find-tab", url: "https://example.com/*" },
      sender: { tab: undefined } as any,
      sendResponse,
      persistOptions: vi.fn(),
      recordError: vi.fn(),
      handleCopyRequest: vi.fn(),
      triggerCommand: vi.fn(),
      getErrorLog: vi.fn(),
      clearErrorLog: vi.fn(),
      resetStorage: vi.fn(),
    });

    expect(handled).toBe(true);
    await flushMicrotasks();

    expect(sendResponse).toHaveBeenCalledWith({
      id: 7,
      windowId: 2,
      url: "https://example.com/article",
      title: "Example",
    });
  });
});
