/**
 * Helpers for formatting captured selections and relaying preview/error information back to the
 * popup. The module doubles as an instrumentation point for end-to-end tests.
 */
import { formatForClipboard } from "../clipboard.js";
import { getErrorMessage, isTransientDisconnectError } from "../lib/errors.js";
import { Timer } from "../lib/timer.js";
import { writeClipboardTextFromBackground } from "./background-clipboard.js";
import { copyTextWithNavigatorClipboard } from "./clipboard-injection.js";
import { ERROR_CONTEXT } from "./error-context.js";
import { recordError } from "./errors.js";
import type { CopySource } from "./types.js";

type RuntimeMessageOptionsWithDocument = chrome.runtime.MessageOptions & {
  documentId?: string;
};

type PopupPreviewPayload = {
  text: string;
  tabId?: number;
  source?: CopySource;
};

const POPUP_PREVIEW_RETRY_DELAY_MS = 100; // Short retry window helps bridge popup startup races without noticeable delay.
const POPUP_PREVIEW_MAX_RETRIES = 3;

let popupReady = false;
let queuedPopupPreview: PopupPreviewPayload | undefined;
const popupPreviewRetryTimer = new Timer();
let activePopupDocumentId: string | undefined;

const isE2EEnabled = (import.meta.env?.VITE_E2E ?? "").toLowerCase() === "true";

let lastFormattedPreview = "";
let lastPreviewError: string | undefined;

function recordE2ePreview(text: string): void {
  if (!isE2EEnabled) {
    return;
  }
  lastFormattedPreview = text;
  lastPreviewError = undefined;
}

function clearE2ePreviewError(): void {
  if (!isE2EEnabled) {
    return;
  }
  lastPreviewError = undefined;
}

function recordE2ePreviewError(message: string): void {
  if (!isE2EEnabled) {
    return;
  }
  lastPreviewError = message;
}

/**
 * Formats the captured markdown for clipboard usage. When the popup initiated the copy we notify it
 * with the formatted preview, falling back to default copy behaviour if the message fails.
 */
export async function runCopyPipeline(
  markdown: string,
  title: string,
  url: string,
  source: CopySource,
  tabId?: number,
): Promise<string> {
  const formatted = await formatForClipboard(markdown, title, url);

  if (source === "popup") {
    queuePopupPreview({ text: formatted, tabId, source });
  }

  recordE2ePreview(formatted);

  let copySucceeded = await copyTextToTab(tabId, formatted, source);

  if (!copySucceeded) {
    try {
      copySucceeded = await writeClipboardTextFromBackground(formatted);
    } catch (error) {
      /* v8 ignore next 5 - writeClipboardTextFromBackground doesn't throw in tests; catches real browser exceptions */
      const message = error instanceof Error ? error.message : String(error);
      void recordError(ERROR_CONTEXT.TabClipboardWrite, message, {
        tabId: typeof tabId === "number" ? tabId : null,
        source,
      });
      copySucceeded = false;
    }
  }

  if (!copySucceeded) {
    recordE2ePreviewError("Clipboard write failed");
  }

  return formatted;
}

export function markPopupReady(): void {
  popupReady = true;
  popupPreviewRetryTimer.cancel();
  if (!queuedPopupPreview) {
    return;
  }
  const pending = queuedPopupPreview;
  queuedPopupPreview = undefined;
  void deliverPopupPreview(pending, 0);
}

export function markPopupClosed(): void {
  popupReady = false;
  activePopupDocumentId = undefined;
  cancelPopupPreviewRetry();

  if (queuedPopupPreview && typeof queuedPopupPreview.tabId === "number") {
    void copyTextToTab(
      queuedPopupPreview.tabId,
      queuedPopupPreview.text,
      queuedPopupPreview.source,
    );
  }

  queuedPopupPreview = undefined;
}

export function setPopupDocumentId(documentId: string | undefined): void {
  activePopupDocumentId = documentId;
}

function queuePopupPreview(payload: PopupPreviewPayload): void {
  queuedPopupPreview = payload;

  cancelPopupPreviewRetry();

  if (!popupReady) {
    return;
  }

  queuedPopupPreview = undefined;
  void deliverPopupPreview(payload, 0);
}

function schedulePopupPreviewRetry(payload: PopupPreviewPayload, attempt: number): void {
  const delay = POPUP_PREVIEW_RETRY_DELAY_MS * Math.max(attempt, 1);
  popupPreviewRetryTimer.schedule(() => {
    if (!popupReady) {
      queuedPopupPreview = payload;
      return;
    }

    queuedPopupPreview = undefined;
    void deliverPopupPreview(payload, attempt);
  }, delay);
}

function cancelPopupPreviewRetry(): void {
  popupPreviewRetryTimer.cancel();
}

async function copyTextToTab(
  tabId: number | undefined,
  text: string,
  source: CopySource | undefined,
): Promise<boolean> {
  /* v8 ignore next 7 - tests always pass valid tabId; guard handles undefined/invalid from corrupted messages */
  if (!Number.isInteger(tabId) || tabId === undefined || tabId < 0) {
    const safeTabId = typeof tabId === "number" && Number.isInteger(tabId) ? tabId : null;
    void recordError(ERROR_CONTEXT.TabClipboardWrite, "Invalid tab id for clipboard copy", {
      tabId: safeTabId,
      source: source ?? "unknown",
    });
    return false;
  }

  /* v8 ignore next 7 - chrome.scripting always available in test mocks; guard handles missing API in non-MV3 contexts */
  if (!chrome.scripting?.executeScript) {
    void recordError(ERROR_CONTEXT.TabClipboardWrite, "chrome.scripting unavailable", {
      tabId,
      source: source ?? "unknown",
    });
    return false;
  }

  try {
    const [response] = await chrome.scripting.executeScript({
      target: { tabId },
      func: copyTextWithNavigatorClipboard,
      args: [text],
    });

    /* v8 ignore next 2 - executeScript returns consistent structure in tests; nullish handling for malformed responses */
    const result =
      (response as { result?: { ok?: boolean; error?: string } } | undefined)?.result ?? null;
    if (result?.ok) {
      return true;
    }

    /* v8 ignore next 4 - tests mock successful clipboard writes; error path handles restricted pages in production */
    const errorMessage = result?.error ?? "Tab clipboard helper returned no result";
    void recordError(ERROR_CONTEXT.TabClipboardWrite, errorMessage, {
      tabId,
      source: source ?? "unknown",
    });
  } catch (error) {
    /* v8 ignore next 4 - chrome.scripting.executeScript exceptions are mocked in tests; real browser throws on restricted pages */
    const message = error instanceof Error ? error.message : String(error);
    void recordError(ERROR_CONTEXT.TabClipboardWrite, message, {
      tabId,
      source: source ?? "unknown",
    });
  }

  return false;
}

async function deliverPopupPreview(payload: PopupPreviewPayload, attempt: number): Promise<void> {
  try {
    const documentId = activePopupDocumentId;
    const runtimeId = chrome.runtime?.id;
    const message = {
      type: "copied-text-preview",
      text: payload.text,
    } as const;

    const currentDocumentId = activePopupDocumentId;
    const shouldTargetDocument = Boolean(
      documentId && runtimeId && documentId === currentDocumentId,
    );

    if (shouldTargetDocument) {
      await chrome.runtime.sendMessage(runtimeId, message, {
        documentId,
      } as RuntimeMessageOptionsWithDocument);
    } else {
      await chrome.runtime.sendMessage(message);
    }
    clearE2ePreviewError();
  } catch (error) {
    const runtimeErrorMessage = chrome.runtime.lastError?.message;
    const normalizedError = runtimeErrorMessage ?? getErrorMessage(error);
    const isTransient = !runtimeErrorMessage || isTransientDisconnectError(runtimeErrorMessage);

    if (isTransient && attempt + 1 < POPUP_PREVIEW_MAX_RETRIES) {
      schedulePopupPreviewRetry(payload, attempt + 1);
      return;
    }

    void recordError(ERROR_CONTEXT.NotifyPopupPreview, normalizedError);

    if (typeof payload.tabId === "number") {
      void copyTextToTab(payload.tabId, payload.text, payload.source);
    }

    recordE2ePreviewError(normalizedError);
  }
}

/** Returns the last formatted preview (test-only helper). */
export function getLastFormattedPreview(): string {
  /* v8 ignore next - E2E-only ternary */
  return isE2EEnabled ? lastFormattedPreview : "";
}

/** Returns the last preview error encountered (test-only helper). */
export function getLastPreviewError(): string | undefined {
  /* v8 ignore next - E2E-only ternary */
  return isE2EEnabled ? lastPreviewError : undefined;
}

/** Overrides the stored preview error (test helper used by E2E suite). */
export function setLastPreviewError(message: string | undefined): void {
  /* v8 ignore next 2 - E2E-only path */
  if (!isE2EEnabled) return;
  lastPreviewError = message;
}

export function resetE2ePreviewState(): void {
  /* v8 ignore next 2 - E2E-only path */
  if (!isE2EEnabled) return;
  lastFormattedPreview = "";
  lastPreviewError = undefined;
}
