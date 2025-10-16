const clipboardLoggerPrefix = "[MarkQuote] Background clipboard";

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return typeof (value as PromiseLike<unknown>)?.then === "function";
}

/**
 * Attempts to write text to the clipboard from the background service worker. Requires the
 * `clipboardWrite` permission so that the write succeeds without a focused extension page.
 */
export async function writeClipboardTextFromBackground(text: string): Promise<boolean> {
  const navigatorClipboard = globalThis.navigator?.clipboard;

  if (navigatorClipboard?.writeText) {
    try {
      await navigatorClipboard.writeText(text);
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
      return true;
    } catch (error) {
      console.debug(`${clipboardLoggerPrefix} chrome.clipboard.writeText failed`, error);
    }
  }

  return false;
}
