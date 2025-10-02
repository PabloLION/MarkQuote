/**
 * Shared error logging utilities for the background worker. Errors are persisted so the popup can
 * display the latest failures to users and aid in support/debugging scenarios.
 */
import { ACTIVE_TAB_PERMISSION_MESSAGE, ERROR_STORAGE_KEY } from "./constants.js";
import { ERROR_CONTEXT, type ErrorContext } from "./error-context.js";
import { isUrlProtected } from "./protected-urls.js";
import type { LoggedError } from "./types.js";

const ERROR_LOG_MAX_ENTRIES = 10; // UX intentionally limits the log to the 10 latest entries shown in the popup; kept local so context stays alongside storage semantics.

/** Restores the badge count based on persisted errors when the worker starts. */
export async function initializeBadgeFromStorage(): Promise<void> {
  const errors = await getStoredErrors();
  updateBadge(errors.length);
}

/** Returns the filtered error log from storage, ignoring malformed entries. */
export async function getStoredErrors(): Promise<LoggedError[]> {
  const storageArea = chrome.storage?.local;
  if (!storageArea) {
    return [];
  }

  const result = await storageArea.get(ERROR_STORAGE_KEY);
  const raw = result?.[ERROR_STORAGE_KEY];
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.filter((entry): entry is LoggedError => Boolean(entry?.message));
}

/**
 * Appends a formatted error entry and updates the badge. Context codes are used so we can group
 * failures when reviewing user reports.
 */
export async function recordError(
  context: ErrorContext,
  error: unknown,
  extra?: Record<string, unknown>,
): Promise<void> {
  const storageArea = chrome.storage?.local;
  if (!storageArea) {
    return;
  }

  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : JSON.stringify(error);

  if (message.includes("Receiving end does not exist")) {
    console.debug("[MarkQuote] Suppressing transient runtime disconnect", { context, message });
    return;
  }

  const tabUrl = typeof extra?.tabUrl === "string" ? extra.tabUrl : undefined;
  if (tabUrl && isUrlProtected(tabUrl) && context === ERROR_CONTEXT.InjectSelectionScript) {
    console.info("[MarkQuote] Skipping protected-page injection error", { tabUrl, message });
    return;
  }

  const existing = await getStoredErrors();
  let contextDetails = message;
  if (tabUrl) {
    if (message.includes("must request permission")) {
      contextDetails = `${message} (tab: ${tabUrl}). ${ACTIVE_TAB_PERMISSION_MESSAGE}`;
    } else if (message.includes("Cannot access contents of the page")) {
      contextDetails = `${message} (tab: ${tabUrl}). Grant host access from the extension action's "Site access" menu.`;
    }
  }

  const decoratedMessage =
    typeof extra?.source === "string" && extra.source.length > 0
      ? `${contextDetails} [source: ${extra.source}]`
      : contextDetails;

  const updated: LoggedError[] = [
    {
      message: decoratedMessage,
      context,
      timestamp: Date.now(),
    },
    ...existing,
  ].slice(0, ERROR_LOG_MAX_ENTRIES);

  try {
    await storageArea.set({ [ERROR_STORAGE_KEY]: updated });
    updateBadge(updated.length);
  } catch (storageError) {
    console.error("[MarkQuote] Failed to persist error log", storageError, {
      originalError: error,
    });
  }
}

/** Clears the stored error log and resets the badge. */
export async function clearStoredErrors(): Promise<void> {
  const storageArea = chrome.storage?.local;
  if (!storageArea) {
    return;
  }

  try {
    await storageArea.set({ [ERROR_STORAGE_KEY]: [] });
    updateBadge(0);
  } catch (storageError) {
    console.error("[MarkQuote] Failed to clear error log", storageError);
  }
}

function updateBadge(count: number): void {
  const text = count > 0 ? String(Math.min(count, 99)) : ""; // Badge intentionally caps at 99 to avoid overflowing the action UI; local constant keeps the rationale near usage.
  chrome.action.setBadgeText({ text }).catch((error) => {
    // Badge updates can fail when the action is unavailable (e.g. during browser shutdown).
    console.debug("[MarkQuote] Failed to update badge text", error);
  });
  if (count > 0) {
    // Badge updates only happen on error boundaries and recoveries, so the sequential API calls
    // keep the code simple with negligible impact on performance.
    chrome.action.setBadgeBackgroundColor({ color: "#d93025" }).catch((error) => {
      console.debug("[MarkQuote] Failed to update badge background", error);
    });
  }
}
