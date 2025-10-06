/**
 * Clipboard helper passed to `chrome.scripting.executeScript` so we can exercise the behaviour in
 * isolation during unit tests. The function runs within the target page context.
 */
export async function copySelectionToClipboard(value: string): Promise<boolean> {
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

  let success = false;
  try {
    success = document.execCommand("copy");
  } finally {
    textarea.remove();
  }

  return success;
}

export type CopySelectionToClipboard = typeof copySelectionToClipboard;
