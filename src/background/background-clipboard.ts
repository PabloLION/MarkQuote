import { E2E_RECORD_CLIPBOARD_PAYLOAD_MESSAGE } from "./constants.js";
import type { CopySource } from "./types.js";

const clipboardLoggerPrefix = "[MarkQuote] Background clipboard";

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return typeof (value as PromiseLike<unknown>)?.then === "function";
}

/**
 * Attempts to write text to the clipboard from the background service worker. Requires the
 * `clipboardWrite` permission so that the write succeeds without a focused extension page.
 */
export async function writeClipboardTextFromBackground(
  text: string,
  metadata: { source?: CopySource } = {},
): Promise<boolean> {
  const navigatorClipboard = globalThis.navigator?.clipboard;
  const isE2EEnabled = (import.meta.env?.VITE_E2E ?? "").toLowerCase() === "true";

  const notifyE2eClipboard = async () => {
    if (!isE2EEnabled) {
      return;
    }
    try {
      await chrome.runtime.sendMessage({
        type: E2E_RECORD_CLIPBOARD_PAYLOAD_MESSAGE,
        text,
        origin: "background",
        source: metadata.source,
      });
    } catch {
      // Ignore instrumentation failures.
    }
  };

  if (navigatorClipboard?.writeText) {
    try {
      await navigatorClipboard.writeText(text);
      await notifyE2eClipboard();
      return true;
    } catch (error) {
      console.debug(`${clipboardLoggerPrefix} navigator.clipboard.writeText failed`, error);
    }
  }

  const chromeClipboard = (globalThis.chrome as { clipboard?: { writeText?: unknown } } | undefined)
    ?.clipboard;
  const writeText = chromeClipboard?.writeText;
  if (typeof writeText === "function") {
    try {
      const result = writeText.call(chromeClipboard, text);
      if (isPromiseLike(result)) {
        await result;
      }
      await notifyE2eClipboard();
      return true;
    } catch (error) {
      console.debug(`${clipboardLoggerPrefix} chrome.clipboard.writeText failed`, error);
    }
  }

  return false;
}
