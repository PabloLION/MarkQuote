// Utilities for Playwright integration tests. When VITE_E2E=true the background worker exposes
// these message handlers so tests can seed storage, trigger copy flows, and read results
// deterministically. In production builds the flag is false, so the handlers lie dormant—this keeps
// the behaviour under test identical to the real extension while avoiding brittle UI setup in the
// harness.
import type { OptionsPayload } from "../options-schema.js";
import { CURRENT_OPTIONS_VERSION } from "../options-schema.js";
import {
  E2E_CLEAR_ERROR_LOG_MESSAGE,
  E2E_CONTEXT_COPY_MESSAGE,
  E2E_FIND_TAB_MESSAGE,
  E2E_GET_ACTIVE_TAB_MESSAGE,
  E2E_GET_CLIPBOARD_PAYLOAD_MESSAGE,
  E2E_GET_ERROR_LOG_MESSAGE,
  E2E_GET_HOTKEY_DIAGNOSTICS_MESSAGE,
  E2E_LAST_FORMATTED_MESSAGE,
  E2E_RECORD_CLIPBOARD_PAYLOAD_MESSAGE,
  E2E_RESET_HOTKEY_DIAGNOSTICS_MESSAGE,
  E2E_RESET_PREVIEW_STATE_MESSAGE,
  E2E_RESET_STORAGE_MESSAGE,
  E2E_SEED_ERROR_MESSAGE,
  E2E_SET_HOTKEY_PINNED_STATE_MESSAGE,
  E2E_SET_OPTIONS_MESSAGE,
  E2E_TRIGGER_COMMAND_MESSAGE,
} from "./constants.js";
import {
  getLastClipboardPayload,
  getLastFormattedPreview,
  getLastPreviewError,
  recordE2eClipboardPayload,
  resetE2ePreviewState,
} from "./copy-pipeline.js";
import { ERROR_CONTEXT, type ErrorContext } from "./error-context.js";
import type { CopySource, LoggedError } from "./types.js";

export type HotkeyDiagnostics = {
  eventTabId: number | null;
  resolvedTabId: number | null;
  stubSelectionUsed: boolean;
  injectionAttempted: boolean;
  injectionSucceeded: boolean | null;
  injectionError: string | null;
  timestamp: number;
};

type MessageContext = {
  request: unknown;
  sender: chrome.runtime.MessageSender;
  sendResponse: ((response?: unknown) => void) | undefined;
  persistOptions: (payload: OptionsPayload) => Promise<void>;
  recordError: (
    context: ErrorContext,
    error: unknown,
    extra?: Record<string, unknown>,
  ) => Promise<void>;
  triggerCopy: (tab: chrome.tabs.Tab | undefined, source: CopySource) => Promise<void>;
  triggerCommand: (tab: chrome.tabs.Tab | undefined, forcePinned?: boolean) => Promise<void>;
  getErrorLog: () => Promise<LoggedError[]>;
  clearErrorLog: () => Promise<void>;
  resetStorage: () => Promise<void>;
};

const DEFAULT_HOTKEY_DIAGNOSTICS: HotkeyDiagnostics = {
  eventTabId: null,
  resolvedTabId: null,
  stubSelectionUsed: false,
  injectionAttempted: false,
  injectionSucceeded: null,
  injectionError: null,
  timestamp: 0,
};
let hotkeyDiagnostics: HotkeyDiagnostics = { ...DEFAULT_HOTKEY_DIAGNOSTICS };
let forcedHotkeyPinnedState: boolean | undefined;

const isE2EEnabled = (import.meta.env?.VITE_E2E ?? "").toLowerCase() === "true";

async function resolveTab(tabId: unknown): Promise<chrome.tabs.Tab | undefined> {
  if (typeof tabId !== "number") {
    return undefined;
  }

  return chrome.tabs.get(tabId);
}

export function resetHotkeyDiagnostics(): void {
  if (!isE2EEnabled) {
    return;
  }
  hotkeyDiagnostics = {
    ...DEFAULT_HOTKEY_DIAGNOSTICS,
    timestamp: Date.now(),
  };
}

export function updateHotkeyDiagnostics(patch: Partial<HotkeyDiagnostics>): void {
  if (!isE2EEnabled) {
    return;
  }
  hotkeyDiagnostics = {
    ...hotkeyDiagnostics,
    ...patch,
    timestamp: Date.now(),
  };
}

export function getHotkeyDiagnostics(): HotkeyDiagnostics {
  if (!isE2EEnabled) {
    return { ...DEFAULT_HOTKEY_DIAGNOSTICS };
  }
  return { ...hotkeyDiagnostics };
}

export function consumeForcedHotkeyPinnedState(): boolean | undefined {
  if (!isE2EEnabled) {
    return undefined;
  }
  const value = forcedHotkeyPinnedState;
  forcedHotkeyPinnedState = undefined;
  return value;
}

export function handleE2eMessage(context: MessageContext): boolean {
  if (!isE2EEnabled) {
    return false;
  }
  const {
    request,
    sendResponse,
    persistOptions,
    recordError,
    triggerCopy,
    triggerCommand,
    getErrorLog,
    clearErrorLog,
    resetStorage,
  } = context;
  const message = request as { type?: string };

  if (message.type === E2E_SET_OPTIONS_MESSAGE) {
    const candidate = (request as { options?: OptionsPayload }).options;
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
        void recordError(ERROR_CONTEXT.PersistOptionsE2E, error);
        sendResponse?.({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    return true;
  }

  if (message.type === E2E_LAST_FORMATTED_MESSAGE) {
    sendResponse?.({
      formatted: getLastFormattedPreview(),
      error: getLastPreviewError(),
    });
    return true;
  }

  if (message.type === E2E_RESET_PREVIEW_STATE_MESSAGE) {
    resetE2ePreviewState();
    sendResponse?.({ ok: true });
    return true;
  }

  if (message.type === E2E_RESET_HOTKEY_DIAGNOSTICS_MESSAGE) {
    resetHotkeyDiagnostics();
    consumeForcedHotkeyPinnedState();
    sendResponse?.({ ok: true });
    return true;
  }

  if (message.type === E2E_TRIGGER_COMMAND_MESSAGE) {
    const { tabId, forcePinned } = request as { tabId?: number; forcePinned?: boolean };
    void (async () => {
      let tab: chrome.tabs.Tab | undefined;
      try {
        tab = await resolveTab(tabId);
      } catch (error) {
        sendResponse?.({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
        return;
      }

      await triggerCommand(tab, forcePinned);
      sendResponse?.({ ok: true });
    })().catch((error) => {
      sendResponse?.({ ok: false, error: error instanceof Error ? error.message : String(error) });
    });
    return true;
  }

  if (message.type === E2E_GET_HOTKEY_DIAGNOSTICS_MESSAGE) {
    sendResponse?.(getHotkeyDiagnostics());
    return true;
  }

  if (message.type === E2E_GET_CLIPBOARD_PAYLOAD_MESSAGE) {
    sendResponse?.({ payload: getLastClipboardPayload() });
    return true;
  }

  if (message.type === E2E_RECORD_CLIPBOARD_PAYLOAD_MESSAGE) {
    const payload = (request as { text?: string }).text;
    if (typeof payload === "string") {
      recordE2eClipboardPayload(payload);
      sendResponse?.({ ok: true });
      return true;
    }
    sendResponse?.({ ok: false, error: "Missing clipboard payload" });
    return true;
  }

  if (message.type === E2E_SET_HOTKEY_PINNED_STATE_MESSAGE) {
    const payload = request as { pinned?: boolean | null };
    if (typeof payload.pinned === "boolean") {
      forcedHotkeyPinnedState = payload.pinned;
    } else {
      forcedHotkeyPinnedState = undefined;
    }
    sendResponse?.({ ok: true });
    return true;
  }

  if (message.type === E2E_CONTEXT_COPY_MESSAGE) {
    const { tabId, source } = request as { tabId?: number; source?: CopySource };
    void (async () => {
      let tab: chrome.tabs.Tab | undefined;
      try {
        tab = await resolveTab(tabId);
      } catch (error) {
        sendResponse?.({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
        return;
      }

      await triggerCopy(tab, source ?? "context-menu");
      sendResponse?.({ ok: true });
    })().catch((error) => {
      sendResponse?.({ ok: false, error: error instanceof Error ? error.message : String(error) });
    });
    return true;
  }

  if (message.type === E2E_GET_ERROR_LOG_MESSAGE) {
    void getErrorLog()
      .then((errors) => {
        sendResponse?.({ errors });
      })
      .catch((error) => {
        sendResponse?.({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    return true;
  }

  if (message.type === E2E_CLEAR_ERROR_LOG_MESSAGE) {
    void clearErrorLog()
      .then(() => {
        sendResponse?.({ ok: true });
      })
      .catch((error) => {
        sendResponse?.({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    return true;
  }

  if (message.type === E2E_SEED_ERROR_MESSAGE) {
    const payload = request as { context?: string; message?: string };
    const context = payload.context;
    if (
      typeof context !== "string" ||
      !Object.values(ERROR_CONTEXT).includes(context as ErrorContext)
    ) {
      sendResponse?.({ ok: false, error: "Invalid error context supplied." });
      return false;
    }

    void recordError(context as ErrorContext, payload.message ?? "Seeded test error")
      .then(() => {
        sendResponse?.({ ok: true });
      })
      .catch((error) => {
        sendResponse?.({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    return true;
  }

  if (message.type === E2E_RESET_STORAGE_MESSAGE) {
    void resetStorage()
      .then(() => {
        sendResponse?.({ ok: true });
      })
      .catch((error) => {
        sendResponse?.({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    return true;
  }

  if (message.type === E2E_GET_ACTIVE_TAB_MESSAGE) {
    void chrome.tabs
      .query({ active: true, lastFocusedWindow: true })
      .then((tabs) => {
        const [tab] = tabs;
        sendResponse?.({
          id: tab?.id ?? null,
          windowId: tab?.windowId ?? null,
          url: tab?.url ?? null,
          title: tab?.title ?? null,
        });
      })
      .catch((error) => {
        sendResponse?.({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    return true;
  }

  if (message.type === E2E_FIND_TAB_MESSAGE) {
    const { url } = request as { url?: string };
    const query: chrome.tabs.QueryInfo = url ? { url } : {};

    void chrome.tabs
      .query(query)
      .then((tabs) => {
        const [tab] = tabs;
        sendResponse?.({
          id: tab?.id ?? null,
          windowId: tab?.windowId ?? null,
          url: tab?.url ?? null,
          title: tab?.title ?? null,
        });
      })
      .catch((error) => {
        sendResponse?.({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    return true;
  }

  return false;
}
