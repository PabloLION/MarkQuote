/**
 * Clipboard helper passed to `chrome.scripting.executeScript`. Runs within the page context under
 * the original user activation so that `navigator.clipboard.writeText` is permitted.
 */
export const CLIPBOARD_MAX_BYTES = 1_000_000; // Prevent unbounded writes that could hang target pages.

export async function copyTextWithNavigatorClipboard(value: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  const maxBytes = 1_000_000;
  const textEncoder = new TextEncoder();
  const byteLength = textEncoder.encode(value).length;
  if (byteLength > maxBytes) {
    console.warn("[MarkQuote] Refusing to copy oversized clipboard payload", {
      bytes: byteLength,
      limit: maxBytes,
    });
    return {
      ok: false,
      error: "Clipboard payload exceeds size limit",
    };
  }

  const clipboard = navigator.clipboard;
  if (!clipboard || typeof clipboard.writeText !== "function") {
    console.warn("[MarkQuote] navigator.clipboard.writeText unavailable");
    return {
      ok: false,
      error: "Clipboard API unavailable",
    };
  }

  try {
    await clipboard.writeText(value);
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("[MarkQuote] navigator.clipboard.writeText rejected", message);
    return {
      ok: false,
      error: message,
    };
  }
}

export type CopyTextWithNavigatorClipboard = typeof copyTextWithNavigatorClipboard;
