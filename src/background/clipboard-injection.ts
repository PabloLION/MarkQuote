import { E2E_RECORD_CLIPBOARD_PAYLOAD_MESSAGE } from "./constants.js";

/**
 * Clipboard helper passed to `chrome.scripting.executeScript` so we can exercise the behaviour in
 * isolation during unit tests. The function runs within the target page context.
 */
export const CLIPBOARD_MAX_BYTES = 1_000_000; // Prevent unbounded writes that could hang target pages.

const textEncoder = new TextEncoder();

export async function copySelectionToClipboard(value: string): Promise<boolean> {
  const byteLength = textEncoder.encode(value).length;
  if (byteLength > CLIPBOARD_MAX_BYTES) {
    console.warn("[MarkQuote] Refusing to copy oversized clipboard payload", {
      bytes: byteLength,
    });
    return false;
  }

  const notifyE2eClipboard = async (payload: string) => {
    try {
      await chrome.runtime.sendMessage({
        type: E2E_RECORD_CLIPBOARD_PAYLOAD_MESSAGE,
        text: payload,
      });
    } catch {
      // Ignore instrumentation failures in automated tests.
    }
  };

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      await notifyE2eClipboard(value);
      return true;
    }
  } catch (_error) {
    // Swallow and fall back to textarea + execCommand path.
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();

  if (typeof document.execCommand !== "function") {
    textarea.remove();
    return false;
  }

  const execCommand = document.execCommand.bind(document);
  let success = false;
  try {
    success = execCommand("copy");
  } finally {
    textarea.remove();
  }

  if (success) {
    await notifyE2eClipboard(value);
  }

  return success;
}

export type CopySelectionToClipboard = typeof copySelectionToClipboard;
