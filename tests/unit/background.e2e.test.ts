import chrome from "sinon-chrome";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleE2eMessage } from "../../src/background/e2e.js";
import { ERROR_CONTEXT, type ErrorContext } from "../../src/background/error-context.js";
import type { CopySource } from "../../src/background/types.js";

const flushMicrotasks = async () => {
  await new Promise((resolve) => setImmediate(resolve));
};

describe("handleE2eMessage", () => {
  beforeEach(() => {
    chrome.reset();
    // @ts-expect-error – vitest environment provides globals but we override for sinon-chrome.
    globalThis.chrome = chrome;
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
      triggerCopy: vi.fn(),
      triggerCommand,
      getErrorLog: vi.fn(),
      clearErrorLog: vi.fn(),
      resetStorage: vi.fn(),
    });

    expect(handled).toBe(true);
    await flushMicrotasks();

    expect(triggerCommand).toHaveBeenCalledWith(tab, undefined);
    expect(sendResponse).toHaveBeenCalledWith({ ok: true });
  });

  it("triggers a context copy flow", async () => {
    const tab = { id: 8 } as any;
    chrome.tabs.get.resolves(tab);

    const triggerCopy = vi.fn().mockResolvedValue(undefined);
    const sendResponse = vi.fn();

    const handled = handleE2eMessage({
      request: { type: "e2e:context-copy", tabId: 8, source: "context-menu" satisfies CopySource },
      sender: { tab: undefined } as any,
      sendResponse,
      persistOptions: vi.fn(),
      recordError: vi.fn(),
      triggerCopy,
      triggerCommand: vi.fn(),
      getErrorLog: vi.fn(),
      clearErrorLog: vi.fn(),
      resetStorage: vi.fn(),
    });

    expect(handled).toBe(true);
    await flushMicrotasks();

    expect(triggerCopy).toHaveBeenCalledWith(tab, "context-menu");
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
      triggerCopy: vi.fn(),
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
      triggerCopy: vi.fn(),
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
      triggerCopy: vi.fn(),
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
      triggerCopy: vi.fn(),
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
      triggerCopy: vi.fn(),
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
      triggerCopy: vi.fn(),
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
      triggerCopy: vi.fn(),
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
