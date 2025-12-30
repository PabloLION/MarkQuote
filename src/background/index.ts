/**
 * Background entry point that orchestrates copy flows, hotkey behaviour, option persistence, and
 * diagnostic telemetry. Centralising these responsibilities keeps chrome API usage contained,
 * which simplifies testing and documents design choices (e.g. session persistence for pending
 * copy sources). Production logging is intentionally retained so support can diagnose field issues
 * without shipping a separate debugging build.
 */

import { MESSAGE_TYPE, STORAGE_KEYS, TIMEOUTS, TRIGGER_SOURCE } from "../lib/constants.js";
import { logInfo } from "../lib/errors.js";
import { Timer } from "../lib/timer.js";
import { normalizeStoredOptions } from "../options-schema.js";
import { DEFAULT_TITLE, DEFAULT_URL } from "./constants.js";
import { registerContextMenus } from "./context-menus.js";
import {
  clearQueuedPopupPreview,
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
import { initializeOrMigrateOptions, persistOptions } from "./options-persistence.js";
import { isUrlProtected } from "./protected-urls.js";
import type { CopySource } from "./types.js";

type RuntimeMessageListener = Parameters<typeof chrome.runtime.onMessage.addListener>[0];
type RuntimeSendResponse = Parameters<RuntimeMessageListener>[2];

const pendingCopySources = new Map<number, CopySource>();
const hotkeyPopupFallbackTimer = new Timer();
let hotkeyFallbackTab: chrome.tabs.Tab | undefined;
/**
 * Flag to prevent duplicate copy requests when confirmation popup opens.
 * Set before opening popup, cleared when REQUEST_SELECTION_COPY is received.
 */
let confirmationPopupPending = false;

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

  await initializeOrMigrateOptions();
}

/**
 * Helper that normalises chrome runtime errors into a human-readable string. Chrome occasionally
 * returns undefined messages, so we supply a fallback.
 */
function getRuntimeLastErrorMessage(): string {
  return chrome.runtime.lastError?.message ?? "Unknown Chrome runtime error";
}

/**
 * Feature detection for chrome.action.openPopup (Chrome 127+).
 * Returns false for older browsers that don't support this API.
 */
function supportsOpenPopup(): boolean {
  return typeof chrome.action?.openPopup === "function";
}

/**
 * Opens the confirmation popup after a copy operation if the user preference is enabled.
 * Only called for hotkey/context-menu sources, not popup-initiated copies.
 *
 * @param windowId - The window ID to open the popup in (for proper focus)
 */
async function maybeOpenConfirmationPopup(windowId?: number): Promise<void> {
  if (!supportsOpenPopup()) {
    logInfo("Confirmation popup skipped: chrome.action.openPopup not available (Chrome < 127)");
    return;
  }

  const storageArea = chrome.storage?.sync;
  if (!storageArea) {
    return;
  }

  try {
    const snapshot = await storageArea.get(["options", "showConfirmationPopup"]);
    const options = normalizeStoredOptions(snapshot);

    if (!options.showConfirmationPopup) {
      return;
    }

    // Set flag to prevent popup from triggering duplicate copy request
    confirmationPopupPending = true;

    const popupOptions = windowId !== undefined ? { windowId } : undefined;
    await chrome.action.openPopup(popupOptions);
    logInfo("Confirmation popup opened after copy");
  } catch (error) {
    // Clear flag if popup failed to open
    confirmationPopupPending = false;
    // Popup may fail to open in some contexts (e.g., no active window)
    // This is not critical, so we just log it
    console.debug("[MarkQuote] Could not open confirmation popup", error);
  }
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

  // Clear any stale preview so protected page message shows instead
  clearQueuedPopupPreview();

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
 * Handles a copy request by injecting the selection script into the target tab. Protected pages
 * are handled gracefully by notifying the popup instead.
 */
async function handleCopyRequest(
  tab: chrome.tabs.Tab | undefined,
  source: CopySource,
): Promise<void> {
  if (!hasValidTabId(tab)) {
    return;
  }

  const tabId = tab.id;

  try {
    await pendingSourcesRestored;
  } catch (error) {
    console.debug(
      "[MarkQuote] Pending copy sources failed to restore before handleCopyRequest",
      error,
    );
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
  } catch (error) {
    // For async/await Chrome APIs, errors are thrown as exceptions, not set in chrome.runtime.lastError
    const lastErrorMessage = error instanceof Error ? error.message : getRuntimeLastErrorMessage();
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
  handleCopyRequest: async (tab, source) => {
    await handleCopyRequest(tab, source);
  },
  initializeOrMigrateOptions,
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
 * Handles the keyboard shortcut flow. Opens popup via chrome.action.openPopup().
 * If popup fails to open (e.g., no focused window), falls back to direct copying.
 */
async function handleHotkeyCommand(tab: chrome.tabs.Tab | undefined): Promise<void> {
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

  // Note: openPopup() works for unpinned extensions (Chrome 127+) as long as window is focused.
  // Previously we checked isPinned and fell back early, but research shows this is unnecessary.
  // If openPopup() fails for any reason, the catch block handles fallback to copy.

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
        handleCopyRequest(resolvedTab, source);
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
      void handleCopyRequest(targetTab, "hotkey");
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
    handleCopyRequest: async (tab, e2eSource) => {
      await handleCopyRequest(tab, e2eSource);
    },
    triggerCommand: async (tab) => {
      await handleHotkeyCommand(tab);
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
      .finally(async () => {
        const title = sender.tab?.title || DEFAULT_TITLE;
        const url = sender.tab?.url || DEFAULT_URL;
        const tabId = sender.tab?.id;
        const source = tabId ? (pendingCopySources.get(tabId) ?? "unknown") : "unknown";

        if (tabId) {
          clearPendingSource(tabId);
        }

        await runCopyPipeline(request.markdown, title, url, source, sender.tab?.id);

        // Open confirmation popup for non-popup sources if preference is enabled
        if (source !== TRIGGER_SOURCE.POPUP) {
          void maybeOpenConfirmationPopup(sender.tab?.windowId);
        }
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

  // Skip copy if this is a confirmation popup (copy already completed)
  if (confirmationPopupPending) {
    confirmationPopupPending = false;
    sendResponse?.({ ok: true });
    return true;
  }

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

      void handleCopyRequest(targetTab, "popup");
      sendResponse?.({ ok: true });
    })
    .catch((error) => {
      void recordError(ERROR_CONTEXT.QueryTabsForCopy, error);
      sendResponse?.({ ok: false });
    });

  return true;
}

/**
 * Picks the most suitable tab for copy execution. Prioritizes the active tab so protected page
 * detection works correctly, then falls back to HTTP tabs if needed.
 */
function pickBestTab(tabs: chrome.tabs.Tab[]): chrome.tabs.Tab | undefined {
  // Filter out popup tabs (we should never copy from ourselves)
  const isPopupTab = (tab: chrome.tabs.Tab) => tab.url?.includes("/popup.html");

  // Active tab takes priority - protected detection happens downstream
  // This allows extension pages (like options.html) to show appropriate protected messages
  const activeTab = tabs.find((tab) => tab.active && !isPopupTab(tab));
  if (activeTab) {
    return activeTab;
  }

  // Fallback: prefer HTTP tabs, then any non-popup tab
  const isHttpTab = (tab: chrome.tabs.Tab) => Boolean(tab.url?.startsWith("http"));
  return tabs.find((tab) => isHttpTab(tab)) ?? tabs.find((tab) => !isPopupTab(tab)) ?? tabs[0];
}
