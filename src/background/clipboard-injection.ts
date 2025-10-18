/**
 * Clipboard helper passed to `chrome.scripting.executeScript` so we can exercise the behaviour in
 * isolation during unit tests. The function runs within the target page context.
 */
export const CLIPBOARD_MAX_BYTES = 1_000_000; // Prevent unbounded writes that could hang target pages.

const textEncoder = new TextEncoder();

export function copySelectionToClipboard(value: string): boolean {
  const byteLength = textEncoder.encode(value).length;
  if (byteLength > CLIPBOARD_MAX_BYTES) {
    console.warn("[MarkQuote] Refusing to copy oversized clipboard payload", {
      bytes: byteLength,
    });
    return false;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();

  let success = false;
  if (typeof document.execCommand === "function") {
    try {
      success = document.execCommand("copy");
    } catch (error) {
      console.warn("[MarkQuote] document.execCommand copy failed", error);
    }
  }

  textarea.remove();

  if (success) {
    return true;
  }

  try {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(value).catch((error) => {
        console.warn("[MarkQuote] navigator.clipboard.writeText fallback rejected", error);
      });
      success = true;
    }
  } catch (error) {
    console.warn("[MarkQuote] navigator.clipboard.writeText fallback failed", error);
  }

  return success;
}

export type CopySelectionToClipboard = typeof copySelectionToClipboard;
