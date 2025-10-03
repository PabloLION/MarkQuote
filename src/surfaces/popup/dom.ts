export interface PopupDom {
  message: HTMLElement;
  messageText: HTMLElement;
  preview: HTMLElement;
  previewCode: HTMLElement | null;
  optionsButton: HTMLElement | null;
  hotkeysButton: HTMLElement | null;
  feedbackButton: HTMLElement | null;
  inlineModeButton: HTMLElement | null;
  problemBadge: HTMLElement | null;
  errorContainer: HTMLElement | null;
  errorList: HTMLElement | null;
  reportErrorsButton: HTMLElement | null;
  dismissErrorsButton: HTMLElement | null;
}

export function loadPopupDom(): PopupDom {
  const message = requireElement("message");
  const messageText = requireElement("message-text");
  const preview = requireElement("preview");

  return {
    message,
    messageText,
    preview,
    previewCode: preview.querySelector("code"),
    optionsButton: document.getElementById("options-button"),
    hotkeysButton: document.getElementById("hotkeys-button"),
    feedbackButton: document.getElementById("feedback-button"),
    inlineModeButton: document.getElementById("inline-mode-button"),
    problemBadge: document.getElementById("problem-badge"),
    errorContainer: document.getElementById("error-container"),
    errorList: document.getElementById("error-list"),
    reportErrorsButton: document.getElementById("report-errors-button"),
    dismissErrorsButton: document.getElementById("dismiss-errors-button"),
  } satisfies PopupDom;
}

function requireElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Popup UI is missing required element: #${id}`);
  }
  return element;
}
