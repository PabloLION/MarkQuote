import { describe, expect, it, vi } from "vitest";
import { createRuntimeBridge } from "../../src/surfaces/popup/helpers/runtime-bridge.js";
import type { RuntimeMessage } from "../../src/surfaces/popup/state.js";

describe("popup runtime bridge", () => {
  function createRuntimeMock() {
    const sendMessage = vi.fn().mockResolvedValue(undefined);
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
});
