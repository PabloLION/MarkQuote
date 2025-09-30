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

export function initializePopup(): () => void {
  const messageDiv = document.getElementById("message");
  const previewDiv = document.getElementById("preview");
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

  const messageListener = (request: RuntimeMessage) => {
    if (request.type === "copied-text-preview") {
      if (previewDiv) {
        previewDiv.textContent = request.text;
      }

      if (messageDiv) {
        messageDiv.textContent = "Copied!";
      }

      void copyToClipboard(request.text).then((success) => {
        if (!success && messageDiv) {
          messageDiv.textContent = "Unable to copy automatically. Text is ready below.";
        }
      });
    } else if (request.type === "copy-protected") {
      if (previewDiv) {
        previewDiv.textContent = "";
      }

      if (messageDiv) {
        messageDiv.textContent =
          "This page is protected, so MarkQuote can't access the selection. Try another tab.";
      }
    }
  };

  chrome.runtime.onMessage.addListener(messageListener);

  chrome.runtime.sendMessage({ type: "request-selection-copy" }).catch((error) => {
    console.warn("Failed to request selection copy.", error);
  });

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

  return () => {
    chrome.runtime.onMessage.removeListener(messageListener);
    optionsButton?.removeEventListener("click", openOptions);
    hotkeysButton?.removeEventListener("click", openShortcuts);
    feedbackButton?.removeEventListener("click", openFeedback);
    inlineModeButton?.removeEventListener("click", openInlineModeIssue);
    reportErrorsButton?.removeEventListener("click", handleReportErrors);
    dismissErrorsButton?.removeEventListener("click", handleDismissErrors);
  };
}
