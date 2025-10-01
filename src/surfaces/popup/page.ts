import { copyMarkdownToClipboard } from "./clipboard.js";
import { loadPopupDom } from "./dom.js";
import { createErrorController } from "./errors.js";
import {
  applyForcedPopupState,
  createDevPreviewApi,
  resolveForcedPopupState,
} from "./forced-state.js";
import { createMessageController } from "./message.js";
import { createPreviewController } from "./preview.js";
import {
  COPIED_STATUS_MESSAGE,
  DEFAULT_STATUS_MESSAGE,
  FEEDBACK_URL,
  type PopupDevPreviewApi,
  PROTECTED_STATUS_MESSAGE,
  type RuntimeMessage,
} from "./state.js";

declare global {
  interface Window {
    __MARKQUOTE_POPUP_DEV__?: PopupDevPreviewApi;
  }
}

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

  const openExternal = (url: string, features = "noopener") => {
    window.open(url, "_blank", features);
  };

  const openOptions = () => {
    if (runtime.openOptionsPage) {
      runtime.openOptionsPage();
      return;
    }

    window.open("options.html", "_blank");
  };

  const openShortcuts = () => {
    const commands = chrome.commands as typeof chrome.commands & {
      openShortcutSettings?: () => void;
    };

    if (typeof commands.openShortcutSettings === "function") {
      commands.openShortcutSettings();
      return;
    }

    window.open("chrome://extensions/shortcuts", "_blank");
  };

  function openFeedback(): void {
    openExternal(FEEDBACK_URL, "noopener");
  }

  const inlineModeLink =
    dom.inlineModeButton?.getAttribute("data-feedback-link") ??
    "https://github.com/PabloLION/MarkQuote/issues/3";
  const openInlineModeIssue = () => openExternal(inlineModeLink, "noopener");

  const errorController = createErrorController(dom, runtime, openFeedback);

  const forcedState = resolveForcedPopupState();

  const messageListener: Parameters<typeof runtime.onMessage.addListener>[0] = (
    request: RuntimeMessage,
  ) => {
    if (request.type === "copied-text-preview") {
      preview.render(request.text);
      messages.set(COPIED_STATUS_MESSAGE, { label: "Copied", variant: "success" });

      void copyMarkdownToClipboard(request.text).then((success) => {
        if (!success) {
          messages.set("Unable to copy automatically. Text is ready below.", {
            variant: "warning",
          });
        }
      });
    } else if (request.type === "copy-protected") {
      preview.clear();
      messages.set(PROTECTED_STATUS_MESSAGE, { label: "Protected", variant: "warning" });
    }
  };

  if (!forcedState) {
    runtime.onMessage.addListener(messageListener);
    runtime.sendMessage({ type: "request-selection-copy" }).catch((error) => {
      console.warn("Failed to request selection copy.", error);
    });
  } else {
    applyForcedPopupState(forcedState, preview, messages);
  }

  const cleanupFns: Array<() => void> = [];

  if (dom.optionsButton) {
    dom.optionsButton.addEventListener("click", openOptions);
    cleanupFns.push(() => dom.optionsButton?.removeEventListener("click", openOptions));
  }

  if (dom.hotkeysButton) {
    dom.hotkeysButton.addEventListener("click", openShortcuts);
    cleanupFns.push(() => dom.hotkeysButton?.removeEventListener("click", openShortcuts));
  }

  if (dom.feedbackButton) {
    dom.feedbackButton.addEventListener("click", openFeedback);
    cleanupFns.push(() => dom.feedbackButton?.removeEventListener("click", openFeedback));
  }

  if (dom.inlineModeButton) {
    dom.inlineModeButton.addEventListener("click", openInlineModeIssue);
    cleanupFns.push(() => dom.inlineModeButton?.removeEventListener("click", openInlineModeIssue));
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
    if (!forcedState) {
      runtime.onMessage.removeListener(messageListener);
    }

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
