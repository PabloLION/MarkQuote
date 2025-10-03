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

const COPY_MENU_ID = "markquote";
const OPTIONS_MENU_ID = "markquote-options";

export function registerContextMenus(config: ContextMenuConfig): void {
  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.removeAll(() => {
      if (chrome.runtime.lastError) {
        const lastErrorMessage = chrome.runtime.lastError.message ?? "Unknown Chrome runtime error";
        void config.recordError(ERROR_CONTEXT.ContextMenusRemoveAll, lastErrorMessage);
      }

      createContextMenu(
        {
          id: COPY_MENU_ID,
          title: "Copy as Markdown Quote",
          contexts: ["selection"],
        },
        config,
      );

      createContextMenu(
        {
          id: OPTIONS_MENU_ID,
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
    if (info.menuItemId === COPY_MENU_ID && tab) {
      void config.triggerCopy(tab, "context-menu");
    } else if (info.menuItemId === OPTIONS_MENU_ID) {
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
