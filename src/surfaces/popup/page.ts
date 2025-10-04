/**
 * Popup surface entry point. Wires DOM handles to controllers for messaging, preview rendering,
 * clipboard fallbacks, and error log management.
 */
import { loadPopupDom } from "./dom.js";
import { createErrorController } from "./errors.js";
import {
  applyForcedPopupState,
  createDevPreviewApi,
  resolveForcedPopupState,
} from "./forced-state.js";
import { createCopyFlow } from "./helpers/copy-flow.js";
import { createPopupNavigation } from "./helpers/navigation.js";
import { createRuntimeBridge } from "./helpers/runtime-bridge.js";
import { createMessageController } from "./message.js";
import { createPreviewController } from "./preview.js";
import {
  DEFAULT_STATUS_MESSAGE,
  FEEDBACK_URL,
  type PopupDevPreviewApi,
  type RuntimeMessage,
} from "./state.js";

declare global {
  interface Window {
    __MARKQUOTE_POPUP_DEV__?: PopupDevPreviewApi;
  }
}

/** Bootstraps the popup surface and returns a disposer for hot module reloading/tests. */
export function initializePopup(): () => void {
  const dom = loadPopupDom();
  const runtime = globalThis.chrome?.runtime;

  if (!runtime) {
    console.warn("chrome.runtime is unavailable; popup interactions are limited.");
    return () => {};
  }

  const messages = createMessageController(dom);
  const preview = createPreviewController(dom);

  messages.set(DEFAULT_STATUS_MESSAGE, { label: "Tip" });
  preview.clear();

  const inlineModeLink =
    dom.inlineModeButton?.getAttribute("data-feedback-link") ??
    "https://github.com/PabloLION/MarkQuote/issues/3";
  const navigation = createPopupNavigation({
    openWindow: (url, target, features) => window.open(url, target, features),
    runtime,
    commands: chrome.commands as typeof chrome.commands & {
      openShortcutSettings?: () => void;
    },
    feedbackUrl: FEEDBACK_URL,
    inlineModeUrl: inlineModeLink,
  });

  const errorController = createErrorController(dom, runtime, navigation.openFeedback);

  const forcedState = resolveForcedPopupState();

  const copyFlow = createCopyFlow({ preview, messages });

  const runtimeBridge = createRuntimeBridge({
    runtime,
    windowRef: window,
    forcedState,
    onMessage: (message: RuntimeMessage) => copyFlow.handleMessage(message),
    onSelectionCopyError: (error) => {
      console.warn("Failed to request selection copy.", error);
    },
  });

  if (forcedState) {
    applyForcedPopupState(forcedState, preview, messages);
  }

  const cleanupFns: Array<() => void> = [];

  if (dom.optionsButton) {
    dom.optionsButton.addEventListener("click", navigation.openOptions);
    cleanupFns.push(() => dom.optionsButton?.removeEventListener("click", navigation.openOptions));
  }

  if (dom.hotkeysButton) {
    dom.hotkeysButton.addEventListener("click", navigation.openShortcuts);
    cleanupFns.push(() =>
      dom.hotkeysButton?.removeEventListener("click", navigation.openShortcuts),
    );
  }

  if (dom.feedbackButton) {
    dom.feedbackButton.addEventListener("click", navigation.openFeedback);
    cleanupFns.push(() =>
      dom.feedbackButton?.removeEventListener("click", navigation.openFeedback),
    );
  }

  if (dom.inlineModeButton) {
    dom.inlineModeButton.addEventListener("click", navigation.openInlineModeIssue);
    cleanupFns.push(() =>
      dom.inlineModeButton?.removeEventListener("click", navigation.openInlineModeIssue),
    );
  }

  void errorController.refresh();

  const devEnvironment = Boolean(
    (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV,
  );

  let devApi: PopupDevPreviewApi | undefined;

  if (devEnvironment) {
    devApi = createDevPreviewApi(preview, messages);
    const globalWithDev = window as typeof window & {
      __MARKQUOTE_POPUP_DEV__?: PopupDevPreviewApi;
    };
    globalWithDev.__MARKQUOTE_POPUP_DEV__ = devApi;
  }

  return () => {
    runtimeBridge.cleanup();
    for (const fn of cleanupFns) {
      fn();
    }
    errorController.dispose();

    if (devApi && devEnvironment) {
      const globalWithDev = window as typeof window & {
        __MARKQUOTE_POPUP_DEV__?: PopupDevPreviewApi;
      };

      if (globalWithDev.__MARKQUOTE_POPUP_DEV__ === devApi) {
        delete globalWithDev.__MARKQUOTE_POPUP_DEV__;
      }
    }
  };
}
