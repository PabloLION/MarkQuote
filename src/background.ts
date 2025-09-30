import {
  DEFAULT_TITLE,
  DEFAULT_URL,
  E2E_LAST_FORMATTED_MESSAGE,
  E2E_SELECTION_MESSAGE,
  E2E_SET_OPTIONS_MESSAGE,
  isE2ETest,
} from "./background/constants.js";
import {
  getLastFormattedPreview,
  getLastPreviewError,
  runCopyPipeline,
  setLastPreviewError,
} from "./background/copy-pipeline.js";
import {
  clearStoredErrors,
  getStoredErrors,
  initializeBadgeFromStorage,
  recordError,
} from "./background/errors.js";
import { isUrlProtected } from "./background/protected-urls.js";
import type { CopySource } from "./background/types.js";
import {
  CURRENT_OPTIONS_VERSION,
  DEFAULT_OPTIONS,
  normalizeStoredOptions,
  type OptionsPayload,
} from "./options-schema.js";

let e2eSelectionStub:
  | {
      markdown: string;
      title: string;
      url: string;
    }
  | undefined;

const pendingCopySources = new Map<number, CopySource>();
let hotkeyPopupFallbackTimer: ReturnType<typeof setTimeout> | undefined;

function clearHotkeyPopupFallback(): void {
  if (hotkeyPopupFallbackTimer !== undefined) {
    clearTimeout(hotkeyPopupFallbackTimer);
    hotkeyPopupFallbackTimer = undefined;
  }
}

function getLastErrorMessage(): string {
  return chrome.runtime.lastError?.message ?? "Unknown Chrome runtime error";
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    if (chrome.runtime.lastError) {
      void recordError("contextMenus.removeAll", getLastErrorMessage());
    }

    chrome.contextMenus.create({
      id: "markquote",
      title: "Copy as Markdown Quote",
      contexts: ["selection"],
    });

    chrome.contextMenus.create({
      id: "markquote-options",
      title: "Options",
      contexts: ["action"],
    });
  });

  void ensureOptionsInitialized();
  void clearStoredErrors();
});

void initializeBadgeFromStorage();

function triggerCopy(tab: chrome.tabs.Tab | undefined, source: CopySource) {
  if (!tab?.id) {
    return;
  }

  const targetUrl = tab.url ?? tab.pendingUrl ?? null;
  if (isUrlProtected(targetUrl)) {
    console.info("[MarkQuote] Skipping copy for protected page", {
      source,
      url: targetUrl,
    });
    chrome.action.openPopup({ windowId: tab.windowId }).catch(() => {});
    void chrome.runtime
      .sendMessage({
        type: "copy-protected",
        url: targetUrl ?? undefined,
      })
      .catch(() => {});
    return;
  }

  pendingCopySources.set(tab.id, source);

  chrome.scripting.executeScript(
    {
      target: { tabId: tab.id },
      files: ["selection.js"],
    },
    () => {
      if (chrome.runtime.lastError) {
        const lastErrorMessage = getLastErrorMessage();
        const permissionsError = lastErrorMessage.includes("must request permission");

        if (permissionsError) {
          console.info("[MarkQuote] Selection injection blocked by host permissions", {
            url: targetUrl,
            source,
            error: lastErrorMessage,
          });
          chrome.action.openPopup({ windowId: tab.windowId }).catch(() => {});
          void chrome.runtime
            .sendMessage({
              type: "copy-protected",
              url: targetUrl ?? undefined,
            })
            .catch(() => {});
          return;
        }

        void recordError("inject-selection-script", lastErrorMessage, {
          tabUrl: tab.url,
          source,
        });
        if (isE2ETest) {
          setLastPreviewError(lastErrorMessage);
        }
      }
    },
  );
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "markquote" && tab) {
    triggerCopy(tab, "context-menu");
  } else if (info.menuItemId === "markquote-options") {
    chrome.runtime.openOptionsPage();
  }
});

chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== "copy-as-markdown-quote") {
    return;
  }

  const handleHotkey = async () => {
    clearHotkeyPopupFallback();

    let isPinned = true;
    try {
      const settings = await chrome.action.getUserSettings();
      isPinned = Boolean(settings?.isOnToolbar);
      console.info("[MarkQuote] Hotkey: action settings", settings);
    } catch (error) {
      console.warn("[MarkQuote] Hotkey: failed to read action settings", error);
      await recordError("hotkey-open-popup", error, { source: "hotkey" });
      if (tab) {
        triggerCopy(tab, "hotkey");
      }
      return;
    }

    if (!isPinned) {
      await recordError(
        "hotkey-open-popup",
        "MarkQuote needs to be pinned to the toolbar so the shortcut can open the popup.",
        { source: "hotkey" },
      );
      if (tab) {
        triggerCopy(tab, "hotkey");
      }
      return;
    }

    if (tab?.windowId !== undefined) {
      await chrome.windows.update(tab.windowId, { focused: true }).catch((error) => {
        console.warn("[MarkQuote] Failed to focus window before opening popup", error);
      });
    }

    if (tab?.id) {
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

    chrome.action
      .openPopup({ windowId: tab?.windowId })
      .then(() => {
        console.info("[MarkQuote] Hotkey: openPopup resolved");
      })
      .catch((error) => {
        clearHotkeyPopupFallback();
        void recordError("open-popup-for-hotkey", error, { source: "hotkey" });
        if (tab) {
          triggerCopy(tab, "hotkey");
        }
      });
  };

  void handleHotkey();
});

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
  if (request?.type === "get-error-log") {
    void getStoredErrors().then((errors) => {
      sendResponse?.({ errors });
    });
    return true;
  }

  if (request?.type === "clear-error-log") {
    void clearStoredErrors().then(() => {
      sendResponse?.({ ok: true });
    });
    return true;
  }

  console.log("Background script received message:", request, { isE2ETest });

  if (request?.type === "request-selection-copy") {
    if (isE2ETest && e2eSelectionStub) {
      const stub = e2eSelectionStub;
      e2eSelectionStub = undefined;
      void runCopyPipeline(stub.markdown, stub.title, stub.url, "e2e").catch((error) => {
        void recordError("e2e-stub-selection", error);
      });
      sendResponse?.({ ok: true });
      return true;
    }

    clearHotkeyPopupFallback();

    void chrome.tabs
      .query({ lastFocusedWindow: true })
      .then((tabs) => {
        const isHttpTab = (tab: chrome.tabs.Tab) => Boolean(tab.url?.startsWith("http"));
        const isExtensionTab = (tab: chrome.tabs.Tab) => tab.url?.startsWith("chrome-extension://");

        const targetTab =
          tabs.find((tab) => tab.active && isHttpTab(tab)) ??
          tabs.find((tab) => isHttpTab(tab)) ??
          tabs.find((tab) => !isExtensionTab(tab)) ??
          tabs[0];

        if (targetTab) {
          const targetUrl = targetTab.url ?? targetTab.pendingUrl ?? null;
          if (isUrlProtected(targetUrl)) {
            void chrome.runtime
              .sendMessage({
                type: "copy-protected",
                url: targetUrl ?? undefined,
              })
              .catch(() => {});
            sendResponse?.({ ok: false, reason: "protected" });
            return;
          }

          triggerCopy(targetTab, "popup");
          sendResponse?.({ ok: true });
        } else {
          void recordError("request-selection-copy", "No suitable tab found for copy request.");
          sendResponse?.({ ok: false });
        }
      })
      .catch((error) => {
        void recordError("query-tabs-for-copy", error);
        sendResponse?.({ ok: false });
      });
    return false;
  }

  if (isE2ETest && request?.type === E2E_SELECTION_MESSAGE) {
    if (typeof request.markdown !== "string" || !request.markdown) {
      console.warn("E2E selection message missing markdown payload.");
      return false;
    }

    const title =
      typeof request.title === "string" && request.title ? request.title : DEFAULT_TITLE;
    const url = typeof request.url === "string" && request.url ? request.url : DEFAULT_URL;
    void runCopyPipeline(request.markdown, title, url, "e2e").then((formatted) => {
      sendResponse?.({ formatted });
    });
    return true;
  }

  if (isE2ETest && request?.type === E2E_SET_OPTIONS_MESSAGE) {
    const candidate = request.options as OptionsPayload | undefined;
    if (!candidate) {
      console.warn("E2E set-options message missing payload.");
      sendResponse?.({ ok: false });
      return false;
    }

    void persistOptions({ ...candidate, version: CURRENT_OPTIONS_VERSION })
      .then(() => {
        sendResponse?.({ ok: true });
      })
      .catch((error) => {
        void recordError("persist-options-e2e", error);
        sendResponse?.({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    return true;
  }

  if (isE2ETest && request?.type === E2E_LAST_FORMATTED_MESSAGE) {
    sendResponse?.({
      formatted: getLastFormattedPreview(),
      error: getLastPreviewError(),
    });
    return true;
  }

  if (isE2ETest && request?.type === "e2e:prime-selection") {
    const markdown = typeof request.markdown === "string" ? request.markdown : "";
    const title =
      typeof request.title === "string" && request.title ? request.title : DEFAULT_TITLE;
    const url = typeof request.url === "string" && request.url ? request.url : DEFAULT_URL;

    if (!markdown) {
      sendResponse?.({
        ok: false,
        error: "Missing markdown payload for stub selection.",
      });
      return false;
    }

    e2eSelectionStub = { markdown, title, url };
    sendResponse?.({ ok: true });
    return true;
  }

  if (request.markdown) {
    const title = sender.tab?.title || DEFAULT_TITLE;
    const url = sender.tab?.url || DEFAULT_URL;
    const source = sender.tab?.id
      ? (pendingCopySources.get(sender.tab.id) ?? "unknown")
      : "unknown";
    if (sender.tab?.id) {
      pendingCopySources.delete(sender.tab.id);
    }
    void runCopyPipeline(request.markdown, title, url, source);
  }
});
