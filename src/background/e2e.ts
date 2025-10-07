// Utilities for Playwright integration tests. When VITE_E2E=true the background worker exposes
// these message handlers so tests can seed storage, trigger copy flows, and read results
// deterministically. In production builds the flag is false, so the handlers lie dormant—this keeps
// the behaviour under test identical to the real extension while avoiding brittle UI setup in the
// harness.
import type { OptionsPayload } from "../options-schema.js";
import { CURRENT_OPTIONS_VERSION } from "../options-schema.js";
import {
  DEFAULT_TITLE,
  DEFAULT_URL,
  E2E_CLEAR_ERROR_LOG_MESSAGE,
  E2E_CONTEXT_COPY_MESSAGE,
  E2E_GET_ERROR_LOG_MESSAGE,
  E2E_LAST_FORMATTED_MESSAGE,
  E2E_RESET_STORAGE_MESSAGE,
  E2E_SEED_ERROR_MESSAGE,
  E2E_SELECTION_MESSAGE,
  E2E_SET_OPTIONS_MESSAGE,
  E2E_TRIGGER_COMMAND_MESSAGE,
} from "./constants.js";
import { getLastFormattedPreview, getLastPreviewError, runCopyPipeline } from "./copy-pipeline.js";
import { ERROR_CONTEXT, type ErrorContext } from "./error-context.js";
import type { CopySource, LoggedError } from "./types.js";

export type SelectionStub = {
  markdown: string;
  title: string;
  url: string;
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
  triggerCommand: (tab: chrome.tabs.Tab | undefined) => Promise<void>;
  getErrorLog: () => Promise<LoggedError[]>;
  clearErrorLog: () => Promise<void>;
  resetStorage: () => Promise<void>;
};

let selectionStub: SelectionStub | undefined;

export function consumeSelectionStub(): SelectionStub | undefined {
  const stub = selectionStub;
  selectionStub = undefined;
  return stub;
}

export function primeSelectionStub(
  markdown: string,
  title: string,
  url: string,
): {
  ok: boolean;
  error?: string;
} {
  if (!markdown) {
    return { ok: false, error: "Missing markdown payload for stub selection." };
  }

  selectionStub = { markdown, title, url };
  return { ok: true };
}

async function resolveTab(tabId: unknown): Promise<chrome.tabs.Tab | undefined> {
  if (typeof tabId !== "number") {
    return undefined;
  }

  return chrome.tabs.get(tabId);
}

export function handleE2eMessage(context: MessageContext): boolean {
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
  const message = request as { type?: string; markdown?: unknown; title?: unknown; url?: unknown };

  if (message.type === E2E_SELECTION_MESSAGE) {
    if (typeof message.markdown !== "string" || !message.markdown) {
      console.warn("E2E selection message missing markdown payload.");
      return false;
    }

    const title =
      typeof message.title === "string" && message.title ? message.title : DEFAULT_TITLE;
    const url = typeof message.url === "string" && message.url ? message.url : DEFAULT_URL;

    void runCopyPipeline(message.markdown, title, url, "e2e").then((formatted) => {
      sendResponse?.({ formatted });
    });
    return true;
  }

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

  if (message.type === E2E_TRIGGER_COMMAND_MESSAGE) {
    const { tabId } = request as { tabId?: number };
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

      await triggerCommand(tab);
      sendResponse?.({ ok: true });
    })().catch((error) => {
      sendResponse?.({ ok: false, error: error instanceof Error ? error.message : String(error) });
    });
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

  if (message.type === "e2e:prime-selection") {
    const markdown = typeof message.markdown === "string" ? message.markdown : "";
    const title =
      typeof message.title === "string" && message.title ? message.title : DEFAULT_TITLE;
    const url = typeof message.url === "string" && message.url ? message.url : DEFAULT_URL;

    const result = primeSelectionStub(markdown, title, url);
    sendResponse?.(result);
    return result.ok;
  }

  return false;
}
