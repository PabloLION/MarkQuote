/**
 * Returns true when the URL points to a browser-internal or privileged surface where content script
 * execution is disallowed. This mirrors Chrome's own restrictions so we can fail gracefully.
 */
export function isUrlProtected(candidate?: string | null): boolean {
  if (!candidate) {
    return false;
  }

  const url = candidate.toLowerCase();
  return (
    url.startsWith("chrome://") ||
    url.startsWith("chrome-error://") ||
    url.startsWith("chrome-untrusted://") ||
    url.startsWith("chrome-search://") ||
    url.startsWith("edge://") ||
    url.startsWith("opera://") ||
    url.startsWith("vivaldi://") ||
    url.startsWith("brave://") ||
    url.startsWith("devtools://") ||
    url.startsWith("about:")
  );
}
