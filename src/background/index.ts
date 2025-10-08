/**
 * Background entry point that orchestrates copy flows, hotkey behaviour, option persistence, and
 * diagnostic telemetry. Centralising these responsibilities keeps chrome API usage contained,
 * which simplifies testing and documents design choices (e.g. session persistence for pending
 * copy sources). Production logging is intentionally retained so support can diagnose field issues
 * without shipping a separate debugging build.
 */
import {
  CURRENT_OPTIONS_VERSION,
  DEFAULT_OPTIONS,
  normalizeStoredOptions,
  type OptionsPayload,
  validateOptionsPayload,
} from "../options-schema.js";
import { DEFAULT_TITLE, DEFAULT_URL, isE2ETest } from "./constants.js";
import { registerContextMenus } from "./context-menus.js";
import {
  markPopupClosed,
  markPopupReady,
  runCopyPipeline,
  setLastPreviewError,
  setPopupDocumentId,
} from "./copy-pipeline.js";
import { consumeSelectionStub, handleE2eMessage } from "./e2e.js";
import { ERROR_CONTEXT } from "./error-context.js";
import {
  clearStoredErrors,
  getStoredErrors,
  initializeBadgeFromStorage,
  recordError,
} from "./errors.js";
import { isUrlProtected } from "./protected-urls.js";
import type { CopySource } from "./types.js";

type RuntimeMessageListener = Parameters<typeof chrome.runtime.onMessage.addListener>[0];
type RuntimeSendResponse = Parameters<RuntimeMessageListener>[2];

const pendingCopySources = new Map<number, CopySource>();
let hotkeyPopupFallbackTimer: ReturnType<typeof setTimeout> | undefined;
let hotkeyFallbackTab: chrome.tabs.Tab | undefined;
const PENDING_COPY_SESSION_KEY = "markquote/pending-copy-sources";
const HOTKEY_POPUP_TIMEOUT_MS = 1000; // 1 second mirrors Chrome's own popup warm-up before falling back.

void initializeBadgeFromStorage();
const pendingSourcesRestored = restorePendingCopySources();

function getSessionStorage(): typeof chrome.storage.session | null {
  return chrome.storage?.session ?? null;
}

function hasValidTabId(tab: chrome.tabs.Tab | undefined): tab is chrome.tabs.Tab & { id: number } {
  return Boolean(tab && typeof tab.id === "number" && Number.isInteger(tab.id) && tab.id >= 0);
}

function cancelHotkeyFallback(): void {
  if (hotkeyPopupFallbackTimer === undefined) {
    return;
  }

  clearTimeout(hotkeyPopupFallbackTimer);
  hotkeyPopupFallbackTimer = undefined;
}

function isCopySource(candidate: unknown): candidate is CopySource {
  return (
    candidate === "popup" ||
    candidate === "hotkey" ||
    candidate === "context-menu" ||
    candidate === "e2e" ||
    candidate === "unknown"
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
    const snapshot = await sessionStorage.get(PENDING_COPY_SESSION_KEY);
    const raw = snapshot?.[PENDING_COPY_SESSION_KEY];
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
    await sessionStorage.set({ [PENDING_COPY_SESSION_KEY]: serialized });
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
      type: "copy-protected",
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

  if (isE2ETest) {
    const stub = consumeSelectionStub();
    if (stub) {
      setPendingSource(tabId, source);
      try {
        await runCopyPipeline(stub.markdown, stub.title, stub.url, "e2e");
      } catch (error) {
        void recordError(ERROR_CONTEXT.E2EStubSelection, error);
      } finally {
        clearPendingSource(tabId);
      }
      return;
    }
  }

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

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["selection.js"],
    });
  } catch (_error) {
    const lastErrorMessage = getRuntimeLastErrorMessage();
    if (lastErrorMessage.includes("must request permission")) {
      notifyCopyProtected(tab, source, targetUrl);
      clearPendingSource(tabId);
      return;
    }

    void recordError(ERROR_CONTEXT.InjectSelectionScript, lastErrorMessage, {
      tabUrl: tab.url,
      source,
    });

    clearPendingSource(tabId);

    if (isE2ETest) {
      setLastPreviewError(lastErrorMessage);
    }
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

  let isPinned = true;
  if (overridePinned === undefined) {
    try {
      const settings = await chrome.action.getUserSettings();
      isPinned = Boolean(settings?.isOnToolbar);
      console.info("[MarkQuote] Hotkey: action settings", settings);
    } catch (error) {
      console.warn("[MarkQuote] Hotkey: failed to read action settings", error);
      await recordError(ERROR_CONTEXT.HotkeyOpenPopup, error, { source });
      if (tab) {
        await triggerCopy(tab, source);
      }
      return;
    }
  } else {
    isPinned = overridePinned;
  }

  if (!isPinned) {
    await recordError(
      ERROR_CONTEXT.HotkeyOpenPopup,
      "MarkQuote needs to be pinned to the toolbar so the shortcut can open the popup.",
      { source },
    );
    if (tab) {
      await triggerCopy(tab, source);
    }
    return;
  }

  if (tab?.windowId !== undefined) {
    await chrome.windows.update(tab.windowId, { focused: true }).catch((error) => {
      console.warn("[MarkQuote] Failed to focus window before opening popup", error);
    });
  }

  if (hasValidTabId(tab)) {
    scheduleHotkeyFallback(tab);
  }

  chrome.action
    .openPopup({ windowId: tab?.windowId })
    .then(() => {
      console.info("[MarkQuote] Hotkey: openPopup resolved");
    })
    .catch((error) => {
      cancelHotkeyFallback();
      void recordError(ERROR_CONTEXT.OpenPopupForHotkey, error, { source });
      if (tab) {
        triggerCopy(tab, source);
      }
    });
}

/**
 * Schedules a timeout that will copy directly if the popup fails to respond to the hotkey. The
 * popup cancels this timer via the "popup-ready" message once it is fully initialised.
 */
function scheduleHotkeyFallback(tab: chrome.tabs.Tab): void {
  hotkeyFallbackTab = tab;
  cancelHotkeyFallback();

  hotkeyPopupFallbackTimer = setTimeout(() => {
    hotkeyPopupFallbackTimer = undefined;
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
  }, HOTKEY_POPUP_TIMEOUT_MS);
}

/**
 * Persists the latest options payload to sync storage while retaining backwards compatibility with
 * earlier schema versions.
 */
async function persistOptions(payload: OptionsPayload): Promise<void> {
  const storageArea = chrome.storage?.sync;
  if (!storageArea) {
    console.warn("chrome.storage.sync is unavailable; cannot persist options.");
    return;
  }

  const normalized = normalizeStoredOptions({ options: payload });
  await storageArea.set({
    options: normalized,
    format: normalized.format,
    titleRules: normalized.titleRules,
    urlRules: normalized.urlRules,
  });
}

/**
 * Ensures sync storage contains a valid options payload. This handles first-run defaults as well as
 * migrations from prior versions.
 */
async function ensureOptionsInitialized(): Promise<void> {
  const storageArea = chrome.storage?.sync;
  if (!storageArea) {
    console.warn("chrome.storage.sync is unavailable; cannot initialize options.");
    return;
  }

  try {
    const snapshot = await storageArea.get([
      "options",
      "format",
      "titleRules",
      "urlRules",
      "rules",
    ]);

    const hasExistingData = Object.values(snapshot).some((value) => {
      if (Array.isArray(value)) {
        return value.length > 0;
      }
      if (value && typeof value === "object") {
        return Object.keys(value).length > 0;
      }
      return Boolean(value);
    });

    if (!hasExistingData) {
      await storageArea.set({
        options: DEFAULT_OPTIONS,
        format: DEFAULT_OPTIONS.format,
        titleRules: DEFAULT_OPTIONS.titleRules,
        urlRules: DEFAULT_OPTIONS.urlRules,
      });
      return;
    }

    const normalized = normalizeStoredOptions(snapshot);

    if (!validateOptionsPayload(snapshot.options)) {
      console.info("[MarkQuote] Normalizing legacy options payload before continuing.");
      await storageArea.set({
        options: normalized,
        format: normalized.format,
        titleRules: normalized.titleRules,
        urlRules: normalized.urlRules,
      });
      return;
    }

    const existingOptions = snapshot.options as { version?: number } | undefined;
    if (existingOptions?.version !== CURRENT_OPTIONS_VERSION) {
      await storageArea.set({
        options: normalized,
        format: normalized.format,
        titleRules: normalized.titleRules,
        urlRules: normalized.urlRules,
      });
    }
  } catch (error) {
    console.warn("Failed to initialize options storage.", error);
    void recordError(ERROR_CONTEXT.InitializeOptions, error);
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (handleErrorLogRequests(request, sendResponse)) {
    return true;
  }

  if (request?.type === "popup-ready") {
    setPopupDocumentId(sender.documentId);
    markPopupReady();
    cancelHotkeyFallback();
    sendResponse?.({ ok: true });
    return false;
  }

  if (request?.type === "popup-closed") {
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

  if (request?.type === "request-selection-copy") {
    if (isE2ETest) {
      const stub = consumeSelectionStub();
      if (stub) {
        void runCopyPipeline(stub.markdown, stub.title, stub.url, "e2e").catch((error) => {
          void recordError(ERROR_CONTEXT.E2EStubSelection, error);
        });
        sendResponse?.({ ok: true });
        return false;
      }
    }

    return handleSelectionCopyRequest(sendResponse);
  }

  if (isE2ETest) {
    const handled = handleE2eMessage({
      request,
      sender,
      sendResponse,
      persistOptions,
      recordError,
      triggerCopy: async (tab, source) => {
        await triggerCopy(tab, source);
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

  if (typedRequest?.type === "get-error-log") {
    void getStoredErrors().then((errors) => {
      sendResponse?.({ errors });
    });
    return true;
  }

  if (typedRequest?.type === "clear-error-log") {
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
    .query({ lastFocusedWindow: true })
    .then((tabs) => {
      const targetTab = pickBestTab(tabs);

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
