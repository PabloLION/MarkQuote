/**
 * Extracts the extension ID from an extension URL.
 * @param url - The full URL (original case preserved)
 * @param prefix - The protocol prefix (e.g., "chrome-extension://")
 * @returns The extension ID or empty string if not parseable
 */
function extractExtensionId(url: string, prefix: string): string {
  const afterPrefix = url.slice(prefix.length);
  const slashIndex = afterPrefix.indexOf("/");
  return slashIndex === -1 ? afterPrefix : afterPrefix.slice(0, slashIndex);
}

/**
 * Protected page types for specific user guidance.
 */
export type ProtectedPageType =
  | "chrome-internal"
  | "edge-internal"
  | "firefox-internal"
  | "extension-page"
  | "same-extension-page"
  | "file-protocol"
  | null;

/**
 * Returns true when the URL points to a browser-internal or privileged surface where content script
 * execution is disallowed. This mirrors Chrome's own restrictions so we can fail gracefully.
 */
export function isUrlProtected(candidate?: string | null): boolean {
  return getProtectedPageType(candidate) !== null;
}

/**
 * Determines the type of protected page for specific user guidance.
 * Returns null if the page is not protected.
 */
export function getProtectedPageType(candidate?: string | null): ProtectedPageType {
  if (!candidate) {
    return null;
  }

  const url = candidate.toLowerCase();

  // Chrome internal pages
  if (
    url.startsWith("chrome://") ||
    url.startsWith("chrome-error://") ||
    url.startsWith("chrome-untrusted://") ||
    url.startsWith("chrome-search://") ||
    url.startsWith("devtools://")
  ) {
    return "chrome-internal";
  }

  // Chrome extension pages - distinguish between own extension and others
  if (url.startsWith("chrome-extension://")) {
    const ownExtensionId = chrome.runtime.id;
    const urlExtensionId = extractExtensionId(candidate, "chrome-extension://");
    return urlExtensionId === ownExtensionId ? "same-extension-page" : "extension-page";
  }

  // Edge internal pages
  if (url.startsWith("edge://")) {
    return "edge-internal";
  }

  // Firefox internal pages
  if (url.startsWith("about:") || url.startsWith("moz-extension://")) {
    return "firefox-internal";
  }

  // Other browser internal pages (Opera, Vivaldi, Brave)
  if (url.startsWith("opera://") || url.startsWith("vivaldi://") || url.startsWith("brave://")) {
    return "chrome-internal"; // Same guidance as Chrome
  }

  // File protocol pages
  if (url.startsWith("file://")) {
    return "file-protocol";
  }

  // Other extension pages (WebExtensions)
  if (url.includes("-extension://")) {
    return "extension-page";
  }

  return null;
}
