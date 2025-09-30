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
