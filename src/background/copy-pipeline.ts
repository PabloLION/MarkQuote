/**
 * Helpers for formatting captured selections and relaying preview/error information back to the
 * popup. The module doubles as an instrumentation point for end-to-end tests.
 */
import { formatForClipboard } from "../clipboard.js";
import { copySelectionToClipboard } from "./clipboard-injection.js";
import { isE2ETest } from "./constants.js";
import { ERROR_CONTEXT } from "./error-context.js";
import { recordError } from "./errors.js";
import type { CopySource } from "./types.js";

type RuntimeMessageOptionsWithDocument = chrome.runtime.MessageOptions & {
  documentId?: string;
};

type PopupPreviewPayload = {
  text: string;
  tabId?: number;
};

const POPUP_PREVIEW_RETRY_DELAY_MS = 100; // Short retry window helps bridge popup startup races without noticeable delay.
const POPUP_PREVIEW_MAX_RETRIES = 3;

let popupReady = false;
let queuedPopupPreview: PopupPreviewPayload | undefined;
let queuedPopupRetryTimer: ReturnType<typeof setTimeout> | undefined;
let activePopupDocumentId: string | undefined;

let lastFormattedPreview = "";
let lastPreviewError: string | undefined;

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
    queuePopupPreview({ text: formatted, tabId });
  }

  if (isE2ETest) {
    lastFormattedPreview = formatted;
    lastPreviewError = undefined;
  }

  return formatted;
}

export function markPopupReady(): void {
  popupReady = true;
  if (queuedPopupRetryTimer) {
    clearTimeout(queuedPopupRetryTimer);
    queuedPopupRetryTimer = undefined;
  }
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
  if (queuedPopupRetryTimer) {
    clearTimeout(queuedPopupRetryTimer);
    queuedPopupRetryTimer = undefined;
  }

  if (queuedPopupPreview && typeof queuedPopupPreview.tabId === "number") {
    void fallbackCopyToTab(queuedPopupPreview.tabId, queuedPopupPreview.text);
  }

  queuedPopupPreview = undefined;
}

export function setPopupDocumentId(documentId: string | undefined): void {
  activePopupDocumentId = documentId;
}

function queuePopupPreview(payload: PopupPreviewPayload): void {
  queuedPopupPreview = payload;

  if (queuedPopupRetryTimer) {
    clearTimeout(queuedPopupRetryTimer);
    queuedPopupRetryTimer = undefined;
  }

  if (!popupReady) {
    return;
  }

  queuedPopupPreview = undefined;
  void deliverPopupPreview(payload, 0);
}

function schedulePopupPreviewRetry(payload: PopupPreviewPayload, attempt: number): void {
  if (queuedPopupRetryTimer) {
    clearTimeout(queuedPopupRetryTimer);
  }

  const delay = POPUP_PREVIEW_RETRY_DELAY_MS * Math.max(attempt, 1);
  queuedPopupRetryTimer = setTimeout(() => {
    queuedPopupRetryTimer = undefined;
    if (!popupReady) {
      queuedPopupPreview = payload;
      return;
    }

    queuedPopupPreview = undefined;
    // Popup readiness can flip between the initial guard above and the delivery call (e.g. a rapid
    // close event racing this timer). Bail out and queue the payload again if readiness changed.
    if (!popupReady) {
      queuedPopupPreview = payload;
      return;
    }
    void deliverPopupPreview(payload, attempt);
  }, delay);
}

async function deliverPopupPreview(payload: PopupPreviewPayload, attempt: number): Promise<void> {
  if (!popupReady) {
    queuedPopupPreview = payload;
    return;
  }

  try {
    const documentId = activePopupDocumentId;
    const runtimeId = chrome.runtime?.id;
    const message = {
      type: "copied-text-preview",
      text: payload.text,
    } as const;

    if (documentId && runtimeId) {
      await chrome.runtime.sendMessage(runtimeId, message, {
        documentId,
      } as RuntimeMessageOptionsWithDocument);
    } else {
      await chrome.runtime.sendMessage(message);
    }
    if (isE2ETest) {
      lastPreviewError = undefined;
    }
  } catch (error) {
    const runtimeErrorMessage = chrome.runtime.lastError?.message;
    const normalizedError =
      runtimeErrorMessage ?? (error instanceof Error ? error.message : String(error));
    const isTransient =
      !runtimeErrorMessage || runtimeErrorMessage.includes("Receiving end does not exist");

    if (isTransient && attempt + 1 < POPUP_PREVIEW_MAX_RETRIES) {
      schedulePopupPreviewRetry(payload, attempt + 1);
      return;
    }

    void recordError(ERROR_CONTEXT.NotifyPopupPreview, normalizedError);

    if (typeof payload.tabId === "number") {
      void fallbackCopyToTab(payload.tabId, payload.text);
    }

    if (isE2ETest) {
      lastPreviewError = normalizedError;
    }
  }
}

async function fallbackCopyToTab(tabId: number, text: string): Promise<void> {
  if (!Number.isInteger(tabId) || tabId < 0) {
    await recordError(ERROR_CONTEXT.PopupClipboardFallback, "Invalid tabId for fallback copy", {
      tabId,
    });
    return;
  }

  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId },
      func: copySelectionToClipboard,
      args: [text],
    });

    const success = Boolean(injection?.result);
    if (!success) {
      await recordError(ERROR_CONTEXT.PopupClipboardFallback, "Failed to copy via fallback", {
        tabId,
      });
    }
  } catch (error) {
    try {
      await recordError(ERROR_CONTEXT.PopupClipboardFallback, error, { tabId });
    } catch (persistError) {
      console.error("[MarkQuote] Failed to record popup fallback error", persistError, {
        tabId,
        originalError: error,
      });
    }
  }
}

/** Returns the last formatted preview (test-only helper). */
export function getLastFormattedPreview(): string {
  return lastFormattedPreview;
}

/** Returns the last preview error encountered (test-only helper). */
export function getLastPreviewError(): string | undefined {
  return lastPreviewError;
}

/** Overrides the stored preview error (test helper used by E2E suite). */
export function setLastPreviewError(message: string | undefined): void {
  lastPreviewError = message;
}
