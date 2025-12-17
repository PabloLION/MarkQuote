/**
 * Shared error logging utilities for the background worker. Errors are persisted so the popup can
 * display the latest failures to users and aid in support/debugging scenarios.
 */

import { COLORS, LIMITS } from "../lib/constants.js";
import { isTransientDisconnectError, logDebug, logError, logInfo } from "../lib/errors.js";
import { ACTIVE_TAB_PERMISSION_MESSAGE, ERROR_STORAGE_KEY } from "./constants.js";
import { ERROR_CONTEXT, type ErrorContext } from "./error-context.js";
import { isUrlProtected } from "./protected-urls.js";
import type { CopySource, DiagnosticMetadata, LoggedError } from "./types.js";

/**
 * Extracts hostname from a URL for privacy-preserving diagnostics.
 * Returns undefined for invalid URLs or empty strings.
 */
function extractHostname(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

/**
 * Builds structured diagnostic metadata for error reports.
 * Automatically captures extension version and user agent.
 */
function buildDiagnosticMetadata(
  error: unknown,
  extra?: Record<string, unknown>,
): DiagnosticMetadata {
  const { tabUrl, source, tabId } = extra ?? {};

  return {
    source: typeof source === "string" ? (source as CopySource) : undefined,
    tabUrl: extractHostname(typeof tabUrl === "string" ? tabUrl : undefined),
    tabId: typeof tabId === "number" ? tabId : undefined,
    stack: error instanceof Error ? error.stack : undefined,
    extensionVersion: chrome.runtime?.getManifest?.()?.version ?? "unknown",
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
  };
}

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

  // Use JSON.stringify for non-Error objects to preserve debugging details
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : JSON.stringify(error);

  if (isTransientDisconnectError(error)) {
    logDebug("Suppressing transient runtime disconnect", { context, message });
    return;
  }

  const { tabUrl, source, ...metadata } = extra ?? {};
  const normalizedTabUrl = typeof tabUrl === "string" ? tabUrl : undefined;
  if (
    normalizedTabUrl &&
    isUrlProtected(normalizedTabUrl) &&
    context === ERROR_CONTEXT.InjectSelectionScript
  ) {
    logInfo("Skipping protected-page injection error", {
      tabUrl: normalizedTabUrl,
      message,
    });
    return;
  }

  const existing = await getStoredErrors();
  let contextDetails = message;
  if (normalizedTabUrl) {
    if (message.includes("must request permission")) {
      contextDetails = `${message} (tab: ${normalizedTabUrl}). ${ACTIVE_TAB_PERMISSION_MESSAGE}`;
    } else if (message.includes("Cannot access contents of the page")) {
      contextDetails = `${message} (tab: ${normalizedTabUrl}). Grant host access from the extension action's "Site access" menu.`;
    }
  }

  const decoratedMessage =
    typeof source === "string" && source.length > 0
      ? `${contextDetails} [source: ${source}]`
      : contextDetails;

  const metadataEntries = Object.entries(metadata).filter(
    ([, value]) => value !== undefined && value !== null,
  );
  /* v8 ignore next 3 - tests always pass metadata; branch handles calls with empty metadata object */
  const appendedMessage =
    metadataEntries.length > 0
      ? `${decoratedMessage}\n${JSON.stringify(Object.fromEntries(metadataEntries), null, 2)}`
      : decoratedMessage;

  const diagnostics = buildDiagnosticMetadata(error, extra);

  const updated: LoggedError[] = [
    {
      message: appendedMessage,
      context,
      timestamp: Date.now(),
      diagnostics,
    },
    ...existing,
  ].slice(0, LIMITS.ERROR_LOG_MAX_ENTRIES);

  try {
    await storageArea.set({ [ERROR_STORAGE_KEY]: updated });
    updateBadge(updated.length);
  } catch (storageError) {
    logError("Failed to persist error log", storageError, {
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
    logError("Failed to clear error log", storageError);
  }
}

function updateBadge(count: number): void {
  const text = count > 0 ? String(Math.min(count, LIMITS.BADGE_MAX_COUNT)) : "";
  chrome.action.setBadgeText({ text }).catch((error) => {
    // Badge updates can fail when the action is unavailable (e.g. during browser shutdown).
    logDebug("Failed to update badge text", { error });
  });
  if (count > 0) {
    // Badge updates only happen on error boundaries and recoveries, so the sequential API calls
    // keep the code simple with negligible impact on performance.
    chrome.action.setBadgeBackgroundColor({ color: COLORS.ERROR }).catch((error) => {
      logDebug("Failed to update badge background", { error });
    });
  }
}
