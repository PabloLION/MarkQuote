import { ACTIVE_TAB_PERMISSION_MESSAGE, ERROR_STORAGE_KEY } from "./constants.js";
import { ERROR_CONTEXT, type ErrorContext } from "./error-context.js";
import { isUrlProtected } from "./protected-urls.js";
import type { LoggedError } from "./types.js";

export async function initializeBadgeFromStorage(): Promise<void> {
  const errors = await getStoredErrors();
  updateBadge(errors.length);
}

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
  ].slice(0, 10);

  await storageArea.set({ [ERROR_STORAGE_KEY]: updated });
  updateBadge(updated.length);
}

export async function clearStoredErrors(): Promise<void> {
  const storageArea = chrome.storage?.local;
  if (!storageArea) {
    return;
  }

  await storageArea.set({ [ERROR_STORAGE_KEY]: [] });
  updateBadge(0);
}

function updateBadge(count: number): void {
  const text = count > 0 ? String(Math.min(count, 99)) : "";
  chrome.action.setBadgeText({ text }).catch(() => {});
  if (count > 0) {
    chrome.action.setBadgeBackgroundColor({ color: "#d93025" }).catch(() => {});
  }
}
