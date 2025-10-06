import { describe, expect, it, vi } from "vitest";
import { createRuntimeBridge } from "../../src/surfaces/popup/helpers/runtime-bridge.js";
import type { RuntimeMessage } from "../../src/surfaces/popup/state.js";

describe("popup runtime bridge", () => {
  function createRuntimeMock(sendMessage = vi.fn().mockResolvedValue(undefined)) {
    const listeners: Array<(message: RuntimeMessage) => void> = [];
    return {
      sendMessage,
      onMessage: {
        addListener: vi.fn((listener: (message: RuntimeMessage) => void) => {
          listeners.push(listener);
        }),
        removeListener: vi.fn((listener: (message: RuntimeMessage) => void) => {
          const index = listeners.indexOf(listener);
          if (index >= 0) {
            listeners.splice(index, 1);
          }
        }),
      },
      emit(message: RuntimeMessage) {
        for (const listener of listeners) {
          listener(message);
        }
      },
    } as unknown as typeof chrome.runtime & { emit: (message: RuntimeMessage) => void };
  }

  it("wires popup ready and selection copy messages", async () => {
    const runtime = createRuntimeMock();
    const onMessage = vi.fn();
    const bridge = createRuntimeBridge({
      runtime,
      windowRef: window,
      onMessage,
    });

    expect(runtime.sendMessage).toHaveBeenNthCalledWith(1, { type: "popup-ready" });
    expect(runtime.sendMessage).toHaveBeenNthCalledWith(2, { type: "request-selection-copy" });

    const sampleMessage = { type: "copy-protected" } as RuntimeMessage;
    (runtime as unknown as { emit: (message: RuntimeMessage) => void }).emit(sampleMessage);
    expect(onMessage).toHaveBeenCalledWith(sampleMessage);

    bridge.cleanup();
    expect(runtime.onMessage.removeListener).toHaveBeenCalledTimes(1);
  });

  it("skips selection copy when forced state provided", () => {
    const runtime = createRuntimeMock();
    const onMessage = vi.fn();

    createRuntimeBridge({
      runtime,
      windowRef: window,
      onMessage,
      forcedState: {},
    });

    expect(runtime.sendMessage).toHaveBeenCalledWith({ type: "popup-ready" });
    expect(runtime.sendMessage).not.toHaveBeenCalledWith({ type: "request-selection-copy" });
    expect(runtime.onMessage.addListener).not.toHaveBeenCalled();
  });

  it("notifies when requesting selection copy fails", async () => {
    const requestError = new Error("request failed");
    const sendMessage = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(requestError);
    const runtime = createRuntimeMock(sendMessage);
    const onSelectionCopyError = vi.fn();

    createRuntimeBridge({
      runtime,
      windowRef: window,
      onMessage: () => {},
      onSelectionCopyError,
    });

    await vi.waitFor(() => {
      expect(onSelectionCopyError).toHaveBeenCalledWith(requestError);
    });
  });

  it("removes lifecycle listeners on cleanup even when forced state skips runtime wiring", () => {
    const runtime = createRuntimeMock();
    const windowStub = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as Window;

    const bridge = createRuntimeBridge({
      runtime,
      windowRef: windowStub,
      onMessage: vi.fn(),
      forcedState: {},
    });

    expect(windowStub.addEventListener).toHaveBeenCalledWith("pagehide", expect.any(Function));
    expect(windowStub.addEventListener).toHaveBeenCalledWith("beforeunload", expect.any(Function));

    bridge.cleanup();

    expect(windowStub.removeEventListener).toHaveBeenCalledWith("pagehide", expect.any(Function));
    expect(windowStub.removeEventListener).toHaveBeenCalledWith(
      "beforeunload",
      expect.any(Function),
    );
    expect(runtime.onMessage.removeListener).not.toHaveBeenCalled();
  });

  it("ignores async return values from message handlers", async () => {
    const runtime = createRuntimeMock();
    const onMessage = vi.fn(() => Promise.resolve("done"));

    createRuntimeBridge({
      runtime,
      windowRef: window,
      onMessage,
    });

    const sampleMessage = { type: "copy-protected" } as RuntimeMessage;
    (runtime as unknown as { emit: (message: RuntimeMessage) => void }).emit(sampleMessage);

    await vi.waitFor(() => {
      expect(onMessage).toHaveBeenCalledWith(sampleMessage);
    });
  });

  it("only notifies popup closed once across multiple lifecycle events", async () => {
    const runtime = createRuntimeMock();
    const listenerMap = new Map<string, EventListener>();
    const windowStub = {
      addEventListener: vi.fn((event: string, listener: EventListener) => {
        listenerMap.set(event, listener);
      }),
      removeEventListener: vi.fn(),
    } as unknown as Window;

    createRuntimeBridge({
      runtime,
      windowRef: windowStub,
      onMessage: vi.fn(),
    });

    const pagehideListener = listenerMap.get("pagehide");
    const beforeunloadListener = listenerMap.get("beforeunload");
    expect(pagehideListener).toBeTruthy();
    expect(beforeunloadListener).toBeTruthy();

    pagehideListener?.(new Event("pagehide"));
    beforeunloadListener?.(new Event("beforeunload"));

    const sendMessageMock = runtime.sendMessage as unknown as ReturnType<typeof vi.fn>;
    const closedCalls = sendMessageMock.mock.calls.filter(
      (args) => args[0]?.type === "popup-closed",
    );
    expect(closedCalls.length).toBe(1);
  });

  it("removes runtime listener when popup closes during async handling", async () => {
    const runtime = createRuntimeMock();
    const listenerMap = new Map<string, EventListener>();
    const windowStub = {
      addEventListener: vi.fn((event: string, listener: EventListener) => {
        listenerMap.set(event, listener);
      }),
      removeEventListener: vi.fn(),
    } as unknown as Window;

    const onMessage = vi.fn(() => new Promise((resolve) => setTimeout(resolve, 0)));
    const bridge = createRuntimeBridge({
      runtime,
      windowRef: windowStub,
      onMessage,
    });

    const listener = (runtime.onMessage.addListener as ReturnType<typeof vi.fn>).mock.calls.at(
      0,
    )?.[0];
    expect(typeof listener).toBe("function");

    (runtime as unknown as { emit: (message: RuntimeMessage) => void }).emit({
      type: "copied-text-preview",
      text: "sample",
    } as RuntimeMessage);

    listenerMap.get("pagehide")?.(new Event("pagehide"));
    await vi.waitFor(() => {
      const sendMessageMock = runtime.sendMessage as unknown as ReturnType<typeof vi.fn>;
      const closedCalls = sendMessageMock.mock.calls.filter(
        (args) => args[0]?.type === "popup-closed",
      );
      expect(closedCalls.length).toBe(1);
    });

    bridge.cleanup();

    expect(runtime.onMessage.removeListener).toHaveBeenCalledWith(listener);
  });
});
