import {
  CURRENT_OPTIONS_VERSION,
  DEFAULT_OPTIONS,
  normalizeStoredOptions,
  type OptionsPayload,
} from "../options-schema.js";
import { DEFAULT_TITLE, DEFAULT_URL, isE2ETest } from "./constants.js";
import { registerContextMenus } from "./context-menus.js";
import { runCopyPipeline, setLastPreviewError } from "./copy-pipeline.js";
import { consumeSelectionStub, handleE2eMessage } from "./e2e.js";
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

void initializeBadgeFromStorage();

function cancelHotkeyFallback(): void {
  if (hotkeyPopupFallbackTimer === undefined) {
    return;
  }

  clearTimeout(hotkeyPopupFallbackTimer);
  hotkeyPopupFallbackTimer = undefined;
}

function getRuntimeLastErrorMessage(): string {
  return chrome.runtime.lastError?.message ?? "Unknown Chrome runtime error";
}

function getTabUrl(tab: chrome.tabs.Tab | undefined): string | null {
  if (!tab) {
    return null;
  }
  return tab.url ?? tab.pendingUrl ?? null;
}

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
    chrome.action.openPopup({ windowId: tab.windowId }).catch(() => {});
  }

  void chrome.runtime
    .sendMessage({
      type: "copy-protected",
      url: url ?? undefined,
    })
    .catch(() => {});
}

function triggerCopy(tab: chrome.tabs.Tab | undefined, source: CopySource): void {
  if (!tab?.id) {
    return;
  }

  const targetUrl = getTabUrl(tab);
  if (isUrlProtected(targetUrl)) {
    notifyCopyProtected(tab, source, targetUrl);
    return;
  }

  pendingCopySources.set(tab.id, source);

  chrome.scripting.executeScript(
    {
      target: { tabId: tab.id },
      files: ["selection.js"],
    },
    () => {
      if (!chrome.runtime.lastError) {
        return;
      }

      const lastErrorMessage = getRuntimeLastErrorMessage();
      if (lastErrorMessage.includes("must request permission")) {
        notifyCopyProtected(tab, source, targetUrl);
        return;
      }

      void recordError("inject-selection-script", lastErrorMessage, {
        tabUrl: tab.url,
        source,
      });

      if (isE2ETest) {
        setLastPreviewError(lastErrorMessage);
      }
    },
  );
}

registerContextMenus({
  triggerCopy: (tab, source) => {
    triggerCopy(tab, source);
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

async function handleHotkeyCommand(tab: chrome.tabs.Tab | undefined): Promise<void> {
  cancelHotkeyFallback();
  const source: CopySource = "hotkey";

  let isPinned = true;
  try {
    const settings = await chrome.action.getUserSettings();
    isPinned = Boolean(settings?.isOnToolbar);
    console.info("[MarkQuote] Hotkey: action settings", settings);
  } catch (error) {
    console.warn("[MarkQuote] Hotkey: failed to read action settings", error);
    await recordError("hotkey-open-popup", error, { source });
    if (tab) {
      triggerCopy(tab, source);
    }
    return;
  }

  if (!isPinned) {
    await recordError(
      "hotkey-open-popup",
      "MarkQuote needs to be pinned to the toolbar so the shortcut can open the popup.",
      { source },
    );
    if (tab) {
      triggerCopy(tab, source);
    }
    return;
  }

  if (tab?.windowId !== undefined) {
    await chrome.windows.update(tab.windowId, { focused: true }).catch((error) => {
      console.warn("[MarkQuote] Failed to focus window before opening popup", error);
    });
  }

  if (tab?.id) {
    scheduleHotkeyFallback(tab);
  }

  chrome.action
    .openPopup({ windowId: tab?.windowId })
    .then(() => {
      console.info("[MarkQuote] Hotkey: openPopup resolved");
    })
    .catch((error) => {
      cancelHotkeyFallback();
      void recordError("open-popup-for-hotkey", error, { source });
      if (tab) {
        triggerCopy(tab, source);
      }
    });
}

function scheduleHotkeyFallback(tab: chrome.tabs.Tab): void {
  cancelHotkeyFallback();

  hotkeyPopupFallbackTimer = setTimeout(() => {
    hotkeyPopupFallbackTimer = undefined;
    void recordError(
      "hotkey-popup-timeout",
      "Popup did not respond to the keyboard shortcut. Falling back to direct copy.",
      { source: "hotkey" },
    );
    triggerCopy(tab, "hotkey");
  }, 1000);
}

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

    const existingOptions = snapshot.options as { version?: number } | undefined;
    if (existingOptions?.version !== CURRENT_OPTIONS_VERSION) {
      const normalized = normalizeStoredOptions(snapshot);
      await storageArea.set({
        options: normalized,
        format: normalized.format,
        titleRules: normalized.titleRules,
        urlRules: normalized.urlRules,
      });
    }
  } catch (error) {
    console.warn("Failed to initialize options storage.", error);
    void recordError("initialize-options", error);
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (handleErrorLogRequests(request, sendResponse)) {
    return true;
  }

  if (request?.type === "request-selection-copy") {
    if (isE2ETest) {
      const stub = consumeSelectionStub();
      if (stub) {
        void runCopyPipeline(stub.markdown, stub.title, stub.url, "e2e").catch((error) => {
          void recordError("e2e-stub-selection", error);
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
    });
    if (handled) {
      return true;
    }
  }

  if (request?.markdown) {
    const title = sender.tab?.title || DEFAULT_TITLE;
    const url = sender.tab?.url || DEFAULT_URL;
    const tabId = sender.tab?.id;
    const source = tabId ? (pendingCopySources.get(tabId) ?? "unknown") : "unknown";

    if (tabId) {
      pendingCopySources.delete(tabId);
    }

    void runCopyPipeline(request.markdown, title, url, source);
  }

  return false;
});

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

function handleSelectionCopyRequest(sendResponse: RuntimeSendResponse): boolean {
  cancelHotkeyFallback();

  chrome.tabs
    .query({ lastFocusedWindow: true })
    .then((tabs) => {
      const targetTab = pickBestTab(tabs);

      if (!targetTab) {
        void recordError("request-selection-copy", "No suitable tab found for copy request.");
        sendResponse?.({ ok: false });
        return;
      }

      const targetUrl = getTabUrl(targetTab);
      if (isUrlProtected(targetUrl)) {
        notifyCopyProtected(targetTab, "popup", targetUrl);
        sendResponse?.({ ok: false, reason: "protected" });
        return;
      }

      triggerCopy(targetTab, "popup");
      sendResponse?.({ ok: true });
    })
    .catch((error) => {
      void recordError("query-tabs-for-copy", error);
      sendResponse?.({ ok: false });
    });

  return true;
}

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
