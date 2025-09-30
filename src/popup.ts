type RuntimeMessage =
  | {
      type: "copied-text-preview";
      text: string;
    }
  | {
      type: "copy-protected";
      url?: string;
    };

type LoggedExtensionError = {
  message: string;
  context: string;
  timestamp: number;
};

const FEEDBACK_URL = "https://github.com/PabloLION/MarkQuote/issues";
const DEFAULT_STATUS_MESSAGE =
  "Select text on a page, then trigger MarkQuote to copy it as a Markdown reference.";
const SAMPLE_PREVIEW =
  "> This was addressed in 2014 when long-standing Markdown contributors released CommonMark, an unambiguous specification and test suite for Markdown.\n> Source: [Wiki:Markdown](https://en.wikipedia.org/wiki/Markdown)";

type ForcedPopupState =
  | { kind: "default" }
  | { kind: "copied"; preview: string }
  | { kind: "protected" };

type PopupDevPreviewApi = {
  showDefault: () => void;
  showSuccess: (text: string) => void;
  showProtected: () => void;
};

declare global {
  interface Window {
    __MARKQUOTE_POPUP_DEV__?: PopupDevPreviewApi;
  }
}

function resolveForcedPopupState(): ForcedPopupState | null {
  const isDev = window.location.hostname === "localhost" || window.location.port === "5173";
  if (!isDev) {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const stateParam = params.get("state");

  if (!stateParam) {
    return null;
  }

  const normalized = stateParam.trim().toLowerCase();

  if (normalized === "default") {
    return { kind: "default" };
  }

  if (normalized === "protected") {
    return { kind: "protected" };
  }

  if (normalized === "copied") {
    const previewParam = params.get("preview");
    const preview = previewParam?.trim().length ? previewParam : SAMPLE_PREVIEW;
    return {
      kind: "copied",
      preview,
    };
  }

  return null;
}

export function initializePopup(): () => void {
  const messageDiv = document.getElementById("message");
  const messageText = document.getElementById("message-text");
  const previewDiv = document.getElementById("preview");
  const previewCode = previewDiv?.querySelector("code");
  const optionsButton = document.getElementById("options-button");
  const hotkeysButton = document.getElementById("hotkeys-button");
  const feedbackButton = document.getElementById("feedback-button");
  const inlineModeButton = document.getElementById("inline-mode-button");
  const problemBadge = document.getElementById("problem-badge");
  const errorContainer = document.getElementById("error-container");
  const errorList = document.getElementById("error-list");
  const reportErrorsButton = document.getElementById("report-errors-button");
  const dismissErrorsButton = document.getElementById("dismiss-errors-button");

  if (!chrome?.runtime) {
    console.warn("chrome.runtime is unavailable; popup interactions are limited.");
    return () => {};
  }

  const copyToClipboard = async (text: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (error) {
      console.warn("navigator.clipboard.writeText failed; falling back to execCommand.", error);
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";
    document.body.append(textarea);
    textarea.select();

    let success = false;
    try {
      success = document.execCommand("copy");
    } catch (error) {
      console.warn('document.execCommand("copy") failed.', error);
    }

    textarea.remove();
    return success;
  };

  const setMessage = (
    text: string,
    options: { label?: string; variant?: "default" | "success" | "warning" } = {},
  ) => {
    if (!messageDiv || !messageText) {
      return;
    }

    if (text.trim().length === 0) {
      messageText.textContent = "";
      messageDiv.setAttribute("hidden", "true");
    } else {
      messageText.textContent = text;
      messageDiv.removeAttribute("hidden");
    }

    if (options.label) {
      messageDiv.dataset.label = options.label;
    } else {
      delete messageDiv.dataset.label;
    }

    const variant = options.variant ?? "default";
    if (variant === "default") {
      delete messageDiv.dataset.variant;
    } else {
      messageDiv.dataset.variant = variant;
    }
  };

  const renderPreview = (text: string | null | undefined) => {
    if (!previewDiv || !previewCode) {
      return;
    }

    if (typeof text !== "string" || text.trim().length === 0) {
      previewCode.textContent = "";
      previewDiv.setAttribute("hidden", "true");
      return;
    }

    previewCode.textContent = text;
    previewDiv.removeAttribute("hidden");
  };

  setMessage(DEFAULT_STATUS_MESSAGE, { label: "Tip" });
  renderPreview(null);

  const applyForcedPopupState = (forcedState: ForcedPopupState) => {
    switch (forcedState.kind) {
      case "default": {
        renderPreview(null);
        setMessage(DEFAULT_STATUS_MESSAGE, { label: "Tip" });
        break;
      }
      case "copied": {
        renderPreview(forcedState.preview);
        setMessage("Markdown copied to clipboard.", {
          label: "Copied",
          variant: "success",
        });
        break;
      }
      case "protected": {
        renderPreview(null);
        setMessage(
          "This page is protected, so MarkQuote can't access the selection. Try another tab.",
          {
            label: "Protected",
            variant: "warning",
          },
        );
        break;
      }
      default: {
        renderPreview(null);
        setMessage(DEFAULT_STATUS_MESSAGE, { label: "Tip" });
      }
    }
  };

  const messageListener = (request: RuntimeMessage) => {
    if (request.type === "copied-text-preview") {
      renderPreview(request.text);

      setMessage("Markdown copied to clipboard.", { label: "Copied", variant: "success" });

      void copyToClipboard(request.text).then((success) => {
        if (!success) {
          setMessage("Unable to copy automatically. Text is ready below.", {
            variant: "warning",
          });
        }
      });
    } else if (request.type === "copy-protected") {
      renderPreview(null);

      setMessage(
        "This page is protected, so MarkQuote can't access the selection. Try another tab.",
        {
          label: "Protected",
          variant: "warning",
        },
      );
    }
  };

  const forcedState = resolveForcedPopupState();

  if (!forcedState) {
    chrome.runtime.onMessage.addListener(messageListener);

    chrome.runtime.sendMessage({ type: "request-selection-copy" }).catch((error) => {
      console.warn("Failed to request selection copy.", error);
    });
  } else {
    applyForcedPopupState(forcedState);
  }

  const openOptions = () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
      return;
    }

    window.open("options.html", "_blank");
  };

  const openShortcuts = () => {
    const openShortcutSettings = (
      chrome.commands as typeof chrome.commands & { openShortcutSettings?: () => void }
    ).openShortcutSettings;

    if (typeof openShortcutSettings === "function") {
      openShortcutSettings();
      return;
    }

    window.open("chrome://extensions/shortcuts", "_blank");
  };

  const openExternal = (url: string) => {
    window.open(url, "_blank", "noopener");
  };

  const openFeedback = () => openExternal(FEEDBACK_URL);
  const inlineModeLink =
    inlineModeButton?.getAttribute("data-feedback-link") ??
    "https://github.com/PabloLION/MarkQuote/issues/3";
  const openInlineModeIssue = () => openExternal(inlineModeLink);

  const fetchErrors = async (): Promise<LoggedExtensionError[]> => {
    if (!chrome?.runtime) {
      return [];
    }

    try {
      const response = (await chrome.runtime.sendMessage({ type: "get-error-log" })) as {
        errors?: LoggedExtensionError[];
      };
      return Array.isArray(response?.errors) ? response.errors : [];
    } catch (error) {
      console.warn("Failed to load error log", error);
      return [];
    }
  };

  const clearErrors = async () => {
    if (!chrome?.runtime) {
      return;
    }

    try {
      await chrome.runtime.sendMessage({ type: "clear-error-log" });
    } catch (error) {
      console.warn("Failed to clear error log", error);
    }
  };

  const renderErrors = (errors: LoggedExtensionError[]) => {
    if (!errorContainer || !errorList || !problemBadge) {
      return;
    }

    if (errors.length === 0) {
      errorContainer.hidden = true;
      problemBadge.setAttribute("hidden", "true");
      problemBadge.textContent = "";
      errorList.innerHTML = "";
      return;
    }

    errorContainer.hidden = false;
    problemBadge.removeAttribute("hidden");
    problemBadge.textContent = String(Math.min(errors.length, 99));

    errorList.innerHTML = "";
    for (const entry of errors) {
      const item = document.createElement("li");
      const timestamp = new Date(entry.timestamp).toLocaleString();
      item.textContent = `[${timestamp}] ${entry.context}: ${entry.message}`;
      errorList.append(item);
    }
  };

  const refreshErrorLog = () => {
    void fetchErrors().then((errors) => {
      renderErrors(errors);
    });
  };

  optionsButton?.addEventListener("click", openOptions);
  hotkeysButton?.addEventListener("click", openShortcuts);
  feedbackButton?.addEventListener("click", openFeedback);
  inlineModeButton?.addEventListener("click", openInlineModeIssue);
  const handleReportErrors = () => {
    openFeedback();
    void clearErrors().then(refreshErrorLog);
  };

  const handleDismissErrors = () => {
    void clearErrors().then(refreshErrorLog);
  };

  reportErrorsButton?.addEventListener("click", handleReportErrors);
  dismissErrorsButton?.addEventListener("click", handleDismissErrors);

  refreshErrorLog();

  let devApi: PopupDevPreviewApi | undefined;

  const isDevEnvironment = Boolean((import.meta as any)?.env?.DEV);

  if (isDevEnvironment) {
    const globalWithDev = window as typeof window & {
      __MARKQUOTE_POPUP_DEV__?: PopupDevPreviewApi;
    };

    devApi = {
      showDefault() {
        renderPreview(null);
        setMessage(DEFAULT_STATUS_MESSAGE, { label: "Tip" });
      },
      showSuccess(text: string) {
        renderPreview(text);
        setMessage("Markdown copied to clipboard.", { label: "Copied", variant: "success" });
      },
      showProtected() {
        renderPreview(null);
        setMessage(
          "This page is protected, so MarkQuote can't access the selection. Try another tab.",
          {
            label: "Protected",
            variant: "warning",
          },
        );
      },
    };

    globalWithDev.__MARKQUOTE_POPUP_DEV__ = devApi;
  }

  return () => {
    if (!forcedState) {
      chrome.runtime.onMessage.removeListener(messageListener);
    }
    optionsButton?.removeEventListener("click", openOptions);
    hotkeysButton?.removeEventListener("click", openShortcuts);
    feedbackButton?.removeEventListener("click", openFeedback);
    inlineModeButton?.removeEventListener("click", openInlineModeIssue);
    reportErrorsButton?.removeEventListener("click", handleReportErrors);
    dismissErrorsButton?.removeEventListener("click", handleDismissErrors);

    if (devApi && isDevEnvironment) {
      const globalWithDev = window as typeof window & {
        __MARKQUOTE_POPUP_DEV__?: PopupDevPreviewApi;
      };

      if (globalWithDev.__MARKQUOTE_POPUP_DEV__ === devApi) {
        delete globalWithDev.__MARKQUOTE_POPUP_DEV__;
      }
    }
  };
}
