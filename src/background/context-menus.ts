import { CONTEXT_MENU_IDS, TRIGGER_SOURCE } from "../lib/constants.js";
import { ERROR_CONTEXT, type ErrorContext } from "./error-context.js";
import type { CopySource } from "./types.js";

type ContextMenuConfig = {
  triggerCopy: (tab: chrome.tabs.Tab, source: CopySource) => Promise<void>;
  ensureOptionsInitialized: () => Promise<void>;
  clearStoredErrors: () => Promise<void>;
  recordError: (
    context: ErrorContext,
    error: unknown,
    extra?: Record<string, unknown>,
  ) => Promise<void>;
};

export function registerContextMenus(config: ContextMenuConfig): void {
  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.removeAll(() => {
      if (chrome.runtime.lastError) {
        const lastErrorMessage = chrome.runtime.lastError.message ?? "Unknown Chrome runtime error";
        void config.recordError(ERROR_CONTEXT.ContextMenusRemoveAll, lastErrorMessage);
      }

      createContextMenu(
        {
          id: CONTEXT_MENU_IDS.COPY,
          title: "Copy as Markdown Quote",
          contexts: ["selection"],
        },
        config,
      );

      createContextMenu(
        {
          id: CONTEXT_MENU_IDS.OPTIONS,
          title: "Options",
          contexts: ["action"],
        },
        config,
      );
    });

    void config.ensureOptionsInitialized();
    void config.clearStoredErrors();
  });

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === CONTEXT_MENU_IDS.COPY && tab) {
      void config.triggerCopy(tab, TRIGGER_SOURCE.CONTEXT_MENU);
    } else if (info.menuItemId === CONTEXT_MENU_IDS.OPTIONS) {
      chrome.runtime.openOptionsPage();
    }
  });
}

function createContextMenu(
  options: chrome.contextMenus.CreateProperties,
  config: ContextMenuConfig,
): void {
  chrome.contextMenus.create(options, () => {
    const lastError = chrome.runtime.lastError;
    if (lastError) {
      const message = lastError.message ?? "Unknown Chrome runtime error";
      void config.recordError(ERROR_CONTEXT.ContextMenusCreate, message, {
        menuId: options.id ?? "unknown",
      });
    }
  });
}
