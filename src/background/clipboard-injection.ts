/**
 * Clipboard helper passed to `chrome.scripting.executeScript`. Runs within the page context under
 * the original user activation so that `navigator.clipboard.writeText` is permitted.
 */
export async function copyTextWithNavigatorClipboard(value: string): Promise<{
  ok: boolean;
  error?: string;
}> {
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
