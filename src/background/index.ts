/**
 * Background entry point that orchestrates copy flows, hotkey behaviour, option persistence, and
 * diagnostic telemetry. Centralising these responsibilities keeps chrome API usage contained,
 * which simplifies testing and documents design choices (e.g. session persistence for pending
 * copy sources). Production logging is intentionally retained so support can diagnose field issues
 * without shipping a separate debugging build.
 */

import { MESSAGE_TYPE, STORAGE_KEYS, TIMEOUTS, TRIGGER_SOURCE } from "../lib/constants.js";
import { Timer } from "../lib/timer.js";
import { DEFAULT_TITLE, DEFAULT_URL } from "./constants.js";
import { registerContextMenus } from "./context-menus.js";
import {
  markPopupClosed,
  markPopupReady,
  resetE2ePreviewState,
  runCopyPipeline,
  setLastPreviewError,
  setPopupDocumentId,
} from "./copy-pipeline.js";
import {
  consumeForcedHotkeyPinnedState,
  handleE2eMessage,
  resetHotkeyDiagnostics,
  updateHotkeyDiagnostics,
} from "./e2e.js";
import { ERROR_CONTEXT } from "./error-context.js";
import {
  clearStoredErrors,
  getStoredErrors,
  initializeBadgeFromStorage,
  recordError,
} from "./errors.js";
import { ensureOptionsInitialized, persistOptions } from "./options-persistence.js";
import { isUrlProtected } from "./protected-urls.js";
import type { CopySource } from "./types.js";

type RuntimeMessageListener = Parameters<typeof chrome.runtime.onMessage.addListener>[0];
type RuntimeSendResponse = Parameters<RuntimeMessageListener>[2];

const pendingCopySources = new Map<number, CopySource>();
const hotkeyPopupFallbackTimer = new Timer();
let hotkeyFallbackTab: chrome.tabs.Tab | undefined;

void initializeBadgeFromStorage();
const pendingSourcesRestored = restorePendingCopySources();

function getSessionStorage(): typeof chrome.storage.session | null {
  return chrome.storage?.session ?? null;
}

function hasValidTabId(tab: chrome.tabs.Tab | undefined): tab is chrome.tabs.Tab & { id: number } {
  return Boolean(tab && typeof tab.id === "number" && Number.isInteger(tab.id) && tab.id >= 0);
}

function cancelHotkeyFallback(): void {
  hotkeyPopupFallbackTimer.cancel();
}

function isCopySource(candidate: unknown): candidate is CopySource {
  return (
    candidate === TRIGGER_SOURCE.POPUP ||
    candidate === TRIGGER_SOURCE.HOTKEY ||
    candidate === TRIGGER_SOURCE.CONTEXT_MENU ||
    candidate === TRIGGER_SOURCE.E2E ||
    candidate === TRIGGER_SOURCE.UNKNOWN
  );
}

/**
 * Restores the pending copy source map from session storage. The map is tiny (at most one entry
 * per active tab) and this recovery only runs when the background service worker wakes, so the
 * overhead is negligible.
 */
async function restorePendingCopySources(): Promise<void> {
  const sessionStorage = getSessionStorage();
  if (!sessionStorage) {
    return;
  }

  try {
    const snapshot = await sessionStorage.get(STORAGE_KEYS.PENDING_COPY_SOURCES);
    const raw = snapshot?.[STORAGE_KEYS.PENDING_COPY_SOURCES];
    if (!raw || typeof raw !== "object") {
      return;
    }

    pendingCopySources.clear();
    for (const [tabId, source] of Object.entries(raw as Record<string, unknown>)) {
      const numericId = Number.parseInt(tabId, 10);
      if (!Number.isNaN(numericId) && isCopySource(source)) {
        pendingCopySources.set(numericId, source);
      }
    }
  } catch (error) {
    void recordError(ERROR_CONTEXT.RestorePendingSources, error);
  }
}

/**
 * Persists the pending copy sources to session storage. Copy requests happen infrequently and only
 * on user gesture, so writing the small map here keeps state resilient without impacting runtime
 * performance.
 */
async function persistPendingCopySources(): Promise<void> {
  const sessionStorage = getSessionStorage();
  if (!sessionStorage) {
    return;
  }

  const serialized: Record<string, CopySource> = {};
  pendingCopySources.forEach((value, key) => {
    serialized[String(key)] = value;
  });

  try {
    await sessionStorage.set({ [STORAGE_KEYS.PENDING_COPY_SOURCES]: serialized });
  } catch (error) {
    void recordError(ERROR_CONTEXT.PersistPendingSources, error);
  }
}

/**
 * Records the source that initiated a copy request for the given tab so we can attribute results
 * (or failures) even if the popup closes or the service worker restarts.
 */
function setPendingSource(tabId: number, source: CopySource): void {
  pendingCopySources.set(tabId, source);
  void persistPendingCopySources();
}

/**
 * Removes the tracked source for the given tab and persists the pending map if an entry was
 * cleared.
 */
function clearPendingSource(tabId: number): void {
  if (pendingCopySources.delete(tabId)) {
    void persistPendingCopySources();
  }

  if (hotkeyFallbackTab?.id === tabId) {
    hotkeyFallbackTab = undefined;
  }
}

async function resetExtensionState(): Promise<void> {
  pendingCopySources.clear();
  hotkeyFallbackTab = undefined;
  cancelHotkeyFallback();
  setPopupDocumentId(undefined);
  markPopupClosed();
  setLastPreviewError(undefined);
  resetE2ePreviewState();
  resetHotkeyDiagnostics();
  consumeForcedHotkeyPinnedState();

  updateHotkeyDiagnostics({
    eventTabId: null,
    resolvedTabId: null,
    injectionAttempted: false,
    injectionSucceeded: null,
    injectionError: null,
  });

  const tasks: Promise<unknown>[] = [];
  const sessionStorage = getSessionStorage();
  if (sessionStorage) {
    tasks.push(sessionStorage.clear());
  }

  const syncStorage = chrome.storage?.sync;
  if (syncStorage) {
    tasks.push(syncStorage.clear());
  }

  tasks.push(clearStoredErrors());

  try {
    await Promise.all(tasks);
  } catch (error) {
    console.warn("[MarkQuote] Failed to reset storage during E2E reset", error);
  }

  await ensureOptionsInitialized();
}

/**
 * Helper that normalises chrome runtime errors into a human-readable string. Chrome occasionally
 * returns undefined messages, so we supply a fallback.
 */
function getRuntimeLastErrorMessage(): string {
  return chrome.runtime.lastError?.message ?? "Unknown Chrome runtime error";
}

/**
 * Resolves the URL for a tab, accounting for pending navigation states. Returns null when the tab
 * information is unavailable (e.g. background pages).
 */
function getTabUrl(tab: chrome.tabs.Tab | undefined): string | null {
  if (!tab) {
    return null;
  }
  return tab.url ?? tab.pendingUrl ?? null;
}

/**
 * Opens the popup (when possible) and notifies the UI that a protected page prevented selection
 * access. The popup will fall back to manual copy messaging.
 */
function notifyCopyProtected(
  tab: chrome.tabs.Tab | undefined,
  source: CopySource,
  url: string | null,
): void {
  console.info("[MarkQuote] Skipping copy for protected page", {
    source,
    url,
  });

  if (tab?.windowId !== undefined) {
    chrome.action.openPopup({ windowId: tab.windowId }).catch((error) => {
      // Some pages block popup focus; surface context but continue with fallback copy.
      console.debug("[MarkQuote] Unable to open popup during protected-page fallback", error);
    });
  }

  void chrome.runtime
    .sendMessage({
      type: MESSAGE_TYPE.COPY_PROTECTED,
      url: url ?? undefined,
    })
    .catch((error) => {
      // The popup might already be closed; log at debug level so we can diagnose silently.
      console.debug("[MarkQuote] Unable to notify popup about protected page", error);
    });
}

/**
 * Injects the selection script for a tab when the host is permitted. Protected pages are handled
 * gracefully by notifying the popup instead.
 */
async function triggerCopy(tab: chrome.tabs.Tab | undefined, source: CopySource): Promise<void> {
  if (!hasValidTabId(tab)) {
    return;
  }

  const tabId = tab.id;

  try {
    await pendingSourcesRestored;
  } catch (error) {
    console.debug("[MarkQuote] Pending copy sources failed to restore before triggerCopy", error);
  }
  const targetUrl = getTabUrl(tab);
  if (isUrlProtected(targetUrl)) {
    notifyCopyProtected(tab, source, targetUrl);
    return;
  }

  setPendingSource(tabId, source);

  let injectionResults:
    | Array<chrome.scripting.InjectionResult<{ success?: boolean; details?: unknown }>>
    | undefined;
  if (source === "hotkey") {
    updateHotkeyDiagnostics({
      stubSelectionUsed: false,
      injectionAttempted: true,
      injectionSucceeded: null,
      injectionError: null,
    });
  }
  try {
    injectionResults = await chrome.scripting.executeScript({
      target: { tabId },
      files: ["selection.js"],
    });
    if (import.meta.env.DEV) {
      const [result] = injectionResults ?? [];
      console.debug("[MarkQuote] Selection script injected", {
        tabId,
        source,
        hasResult: Boolean(result?.result),
      });
    }
    if (source === "hotkey") {
      updateHotkeyDiagnostics({
        injectionSucceeded: true,
        injectionError: null,
      });
    }
  } catch (_error) {
    const lastErrorMessage = getRuntimeLastErrorMessage();
    if (lastErrorMessage.includes("must request permission")) {
      notifyCopyProtected(tab, source, targetUrl);
      clearPendingSource(tabId);
      if (source === "hotkey") {
        updateHotkeyDiagnostics({
          injectionSucceeded: false,
          injectionError: lastErrorMessage,
        });
      }
      return;
    }

    void recordError(ERROR_CONTEXT.InjectSelectionScript, lastErrorMessage, {
      tabUrl: tab.url,
      tabId,
      source,
    });

    clearPendingSource(tabId);

    if (source === "hotkey") {
      updateHotkeyDiagnostics({
        injectionSucceeded: false,
        injectionError: lastErrorMessage,
      });
    }

    setLastPreviewError(lastErrorMessage);
  }
}

registerContextMenus({
  triggerCopy: async (tab, source) => {
    await triggerCopy(tab, source);
  },
  ensureOptionsInitialized,
  clearStoredErrors,
  recordError,
});

chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== "copy-as-markdown-quote") {
    return;
  }

  void handleHotkeyCommand(tab);
});

/**
 * Handles the keyboard shortcut flow. Chrome requires the action to be pinned before the popup can
 * open, so we detect that case and fall back to direct copying.
 */
async function handleHotkeyCommand(
  tab: chrome.tabs.Tab | undefined,
  overridePinned?: boolean,
): Promise<void> {
  cancelHotkeyFallback();
  const source: CopySource = "hotkey";
  resetHotkeyDiagnostics();
  updateHotkeyDiagnostics({
    eventTabId: hasValidTabId(tab) ? tab.id : null,
  });
  const resolvedTab = await resolveHotkeyTab(tab);
  updateHotkeyDiagnostics({
    resolvedTabId: hasValidTabId(resolvedTab) ? resolvedTab.id : null,
  });

  let isPinned = true;
  const forcedPinned = consumeForcedHotkeyPinnedState();
  if (overridePinned !== undefined) {
    isPinned = overridePinned;
  } else if (forcedPinned !== undefined) {
    isPinned = forcedPinned;
  } else {
    try {
      const settings = await chrome.action.getUserSettings();
      isPinned = Boolean(settings?.isOnToolbar);
      console.info("[MarkQuote] Hotkey: action settings", settings);
    } catch (error) {
      console.warn("[MarkQuote] Hotkey: failed to read action settings", error);
      await recordError(ERROR_CONTEXT.HotkeyOpenPopup, error, { source });
      const fallbackTab = resolvedTab ?? tab;
      if (fallbackTab) {
        updateHotkeyDiagnostics({
          injectionAttempted: false,
          injectionSucceeded: null,
          injectionError: null,
        });
        await triggerCopy(fallbackTab, source);
      } else {
        console.warn("[MarkQuote] Hotkey: unable to resolve tab after settings failure.");
      }
      return;
    }
  }
  if (!isPinned) {
    await recordError(
      ERROR_CONTEXT.HotkeyOpenPopup,
      "Shortcut ran while the toolbar icon was hidden. Pin MarkQuote to finish copying automatically.",
      {
        source,
        tabUrl: resolvedTab?.url,
        tabId: resolvedTab?.id ?? null,
        tabProvidedInEvent: Boolean(tab && hasValidTabId(tab)),
        resolvedTab: Boolean(resolvedTab && hasValidTabId(resolvedTab)),
        fallbackTriggered: Boolean(resolvedTab),
      },
    );
    if (resolvedTab) {
      updateHotkeyDiagnostics({
        injectionAttempted: false,
        injectionSucceeded: null,
        injectionError: null,
      });
      await triggerCopy(resolvedTab, source);
    } else {
      console.warn("[MarkQuote] Hotkey: unable to resolve active tab for fallback copy.");
    }
    return;
  }

  if (resolvedTab?.windowId !== undefined) {
    await chrome.windows.update(resolvedTab.windowId, { focused: true }).catch((error) => {
      console.warn("[MarkQuote] Failed to focus window before opening popup", error);
    });
  }

  if (resolvedTab && hasValidTabId(resolvedTab)) {
    scheduleHotkeyFallback(resolvedTab);
  }

  chrome.action
    .openPopup({ windowId: resolvedTab?.windowId })
    .then(() => {
      console.info("[MarkQuote] Hotkey: openPopup resolved");
    })
    .catch((error) => {
      cancelHotkeyFallback();
      void recordError(ERROR_CONTEXT.OpenPopupForHotkey, error, {
        source,
        tabUrl: resolvedTab?.url,
        tabId: resolvedTab?.id ?? null,
        tabProvidedInEvent: Boolean(tab && hasValidTabId(tab)),
        resolvedTab: Boolean(resolvedTab && hasValidTabId(resolvedTab)),
      });
      if (resolvedTab) {
        triggerCopy(resolvedTab, source);
      }
    });
}

async function resolveHotkeyTab(
  tab: chrome.tabs.Tab | undefined,
): Promise<chrome.tabs.Tab | undefined> {
  if (tab && hasValidTabId(tab)) {
    return tab;
  }

  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab && hasValidTabId(activeTab)) {
      return activeTab;
    }
  } catch (error) {
    console.warn("[MarkQuote] Hotkey: failed to resolve active tab for shortcut", error);
  }

  return tab;
}

/**
 * Schedules a timeout that will copy directly if the popup fails to respond to the hotkey. The
 * popup cancels this timer via the "popup-ready" message once it is fully initialised.
 */
function scheduleHotkeyFallback(tab: chrome.tabs.Tab): void {
  hotkeyFallbackTab = tab;

  hotkeyPopupFallbackTimer.schedule(() => {
    const targetTab = hotkeyFallbackTab;
    hotkeyFallbackTab = undefined;
    void recordError(
      ERROR_CONTEXT.HotkeyPopupTimeout,
      "Popup did not respond to the keyboard shortcut. Falling back to direct copy.",
      { source: "hotkey" },
    );
    if (targetTab) {
      void triggerCopy(targetTab, "hotkey");
    }
  }, TIMEOUTS.HOTKEY_POPUP_MS);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (handleErrorLogRequests(request, sendResponse)) {
    return true;
  }

  if (request?.type === MESSAGE_TYPE.POPUP_READY) {
    setPopupDocumentId(sender.documentId);
    markPopupReady();
    cancelHotkeyFallback();
    sendResponse?.({ ok: true });
    return false;
  }

  if (request?.type === MESSAGE_TYPE.POPUP_CLOSED) {
    setPopupDocumentId(undefined);
    markPopupClosed();
    if (hotkeyFallbackTab && hasValidTabId(hotkeyFallbackTab)) {
      const tabId = hotkeyFallbackTab.id;
      if (pendingCopySources.has(tabId)) {
        scheduleHotkeyFallback(hotkeyFallbackTab);
      }
    }
    return false;
  }

  if (request?.type === MESSAGE_TYPE.REQUEST_SELECTION_COPY) {
    return handleSelectionCopyRequest(sendResponse);
  }

  const handled = handleE2eMessage({
    request,
    sender,
    sendResponse,
    persistOptions,
    recordError,
    triggerCopy: async (tab, e2eSource) => {
      await triggerCopy(tab, e2eSource);
    },
    triggerCommand: async (tab, forcePinned) => {
      await handleHotkeyCommand(tab, forcePinned);
    },
    getErrorLog: getStoredErrors,
    clearErrorLog: clearStoredErrors,
    resetStorage: resetExtensionState,
  });
  if (handled) {
    return true;
  }

  if (request?.markdown) {
    pendingSourcesRestored
      .catch((error) => {
        console.debug(
          "[MarkQuote] Pending copy sources were not restored before handling message",
          error,
        );
      })
      .finally(() => {
        const title = sender.tab?.title || DEFAULT_TITLE;
        const url = sender.tab?.url || DEFAULT_URL;
        const tabId = sender.tab?.id;
        const source = tabId ? (pendingCopySources.get(tabId) ?? "unknown") : "unknown";

        if (tabId) {
          clearPendingSource(tabId);
        }

        void runCopyPipeline(request.markdown, title, url, source, sender.tab?.id);
      });
  }

  return false;
});

/**
 * Handles background messages for reading and clearing the diagnostic error log.
 */
function handleErrorLogRequests(request: unknown, sendResponse: RuntimeSendResponse): boolean {
  const typedRequest = request as { type?: string } | undefined;

  if (typedRequest?.type === MESSAGE_TYPE.GET_ERROR_LOG) {
    void getStoredErrors().then((errors) => {
      sendResponse?.({ errors });
    });
    return true;
  }

  if (typedRequest?.type === MESSAGE_TYPE.CLEAR_ERROR_LOG) {
    void clearStoredErrors().then(() => {
      sendResponse?.({ ok: true });
    });
    return true;
  }

  return false;
}

/**
 * Attempts to trigger a selection copy from the currently focused window. This is used by the
 * popup when it loads and by tests via message passing.
 */
function handleSelectionCopyRequest(sendResponse: RuntimeSendResponse): boolean {
  cancelHotkeyFallback();

  chrome.tabs
    .query({ lastFocusedWindow: true, windowType: "normal" })
    .then(async (tabs) => {
      let targetTab = pickBestTab(tabs);

      if (!targetTab) {
        const normalTabs = await chrome.tabs.query({ windowType: "normal" });
        targetTab = pickBestTab(normalTabs);
      }

      if (!targetTab) {
        void recordError(
          ERROR_CONTEXT.RequestSelectionCopy,
          "No suitable tab found for copy request.",
        );
        sendResponse?.({ ok: false });
        return;
      }

      const targetUrl = getTabUrl(targetTab);
      if (isUrlProtected(targetUrl)) {
        notifyCopyProtected(targetTab, "popup", targetUrl);
        sendResponse?.({ ok: false, reason: "protected" });
        return;
      }

      void triggerCopy(targetTab, "popup");
      sendResponse?.({ ok: true });
    })
    .catch((error) => {
      void recordError(ERROR_CONTEXT.QueryTabsForCopy, error);
      sendResponse?.({ ok: false });
    });

  return true;
}

/**
 * Picks the most suitable tab for copy execution. Prefers the active HTTP(S) tab, but gracefully
 * falls back to other candidates if needed.
 */
function pickBestTab(tabs: chrome.tabs.Tab[]): chrome.tabs.Tab | undefined {
  const isHttpTab = (tab: chrome.tabs.Tab) => Boolean(tab.url?.startsWith("http"));
  const isExtensionTab = (tab: chrome.tabs.Tab) => tab.url?.startsWith("chrome-extension://");

  return (
    tabs.find((tab) => tab.active && isHttpTab(tab)) ??
    tabs.find((tab) => isHttpTab(tab)) ??
    tabs.find((tab) => !isExtensionTab(tab)) ??
    tabs[0]
  );
}
