type CopiedTextMessage = {
  type: "copied-text-preview";
  text: string;
};

const FEEDBACK_URL = "https://github.com/PabloLION/MarkQuote";
const INLINE_MODE_DISCUSSION_URL =
  "https://github.com/PabloLION/MarkQuote/issues?q=is%3Aissue+inline+mode";

export function initializePopup(): () => void {
  const messageDiv = document.getElementById("message");
  const previewDiv = document.getElementById("preview");
  const optionsButton = document.getElementById("options-button");
  const hotkeysButton = document.getElementById("hotkeys-button");
  const feedbackButton = document.getElementById("feedback-button");
  const inlineModeButton = document.getElementById("inline-mode-button");

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

  const messageListener = (request: CopiedTextMessage) => {
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
  const openInlineModeIssue = () => openExternal(INLINE_MODE_DISCUSSION_URL);

  optionsButton?.addEventListener("click", openOptions);
  hotkeysButton?.addEventListener("click", openShortcuts);
  feedbackButton?.addEventListener("click", openFeedback);
  inlineModeButton?.addEventListener("click", openInlineModeIssue);

  return () => {
    chrome.runtime.onMessage.removeListener(messageListener);
    optionsButton?.removeEventListener("click", openOptions);
    hotkeysButton?.removeEventListener("click", openShortcuts);
    feedbackButton?.removeEventListener("click", openFeedback);
    inlineModeButton?.removeEventListener("click", openInlineModeIssue);
  };
}
