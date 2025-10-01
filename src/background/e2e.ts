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
  E2E_LAST_FORMATTED_MESSAGE,
  E2E_SELECTION_MESSAGE,
  E2E_SET_OPTIONS_MESSAGE,
} from "./constants.js";
import { getLastFormattedPreview, getLastPreviewError, runCopyPipeline } from "./copy-pipeline.js";

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
  recordError: (context: string, error: unknown, extra?: Record<string, unknown>) => Promise<void>;
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

export function handleE2eMessage(context: MessageContext): boolean {
  const { request, sender, sendResponse, persistOptions, recordError } = context;
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
        void recordError("persist-options-e2e", error);
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
