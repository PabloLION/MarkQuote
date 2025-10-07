import type { RuntimeMessage } from "../state.js";

interface RuntimeBridgeDeps {
  runtime: typeof chrome.runtime;
  windowRef: Window;
  forcedState?: unknown;
  onMessage: (request: RuntimeMessage) => void;
  onSelectionCopyError?: (error: unknown) => void;
}

export interface RuntimeBridge {
  cleanup: () => void;
}

export function createRuntimeBridge(deps: RuntimeBridgeDeps): RuntimeBridge {
  const { runtime, windowRef } = deps;

  runtime.sendMessage({ type: "popup-ready" }).catch(() => {
    // background may be asleep; ignore
  });

  let notifiedClosure = false;
  const notifyPopupClosed = () => {
    if (notifiedClosure) {
      return;
    }
    notifiedClosure = true;
    runtime.sendMessage({ type: "popup-closed" }).catch(() => {
      // ignore errors for suspended background worker
    });
  };

  windowRef.addEventListener("pagehide", notifyPopupClosed);
  windowRef.addEventListener("beforeunload", notifyPopupClosed);

  let messageListener: ((request: RuntimeMessage) => void) | undefined;

  if (!deps.forcedState) {
    messageListener = (request) => {
      const result = deps.onMessage(request) as unknown;
      if (result && typeof (result as Promise<unknown>).then === "function") {
        void (result as Promise<unknown>);
      }
    };
    runtime.onMessage.addListener(
      messageListener as Parameters<typeof runtime.onMessage.addListener>[0],
    );

    runtime.sendMessage({ type: "request-selection-copy" }).catch((error) => {
      deps.onSelectionCopyError?.(error);
    });
  }

  return {
    cleanup: () => {
      if (messageListener) {
        runtime.onMessage.removeListener(
          messageListener as Parameters<typeof runtime.onMessage.addListener>[0],
        );
      }
      windowRef.removeEventListener("pagehide", notifyPopupClosed);
      windowRef.removeEventListener("beforeunload", notifyPopupClosed);
    },
  };
}
