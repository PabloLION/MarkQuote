/**
 * Clipboard helper passed to `chrome.scripting.executeScript` so we can exercise the behaviour in
 * isolation during unit tests. The function runs within the target page context.
 */
export const CLIPBOARD_MAX_BYTES = 1_000_000; // Prevent unbounded writes that could hang target pages.

export async function copySelectionToClipboard(value: string): Promise<boolean> {
  if (value.length > CLIPBOARD_MAX_BYTES) {
    console.warn("[MarkQuote] Refusing to copy oversized clipboard payload", {
      length: value.length,
    });
    return false;
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
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

  return success;
}

export type CopySelectionToClipboard = typeof copySelectionToClipboard;
