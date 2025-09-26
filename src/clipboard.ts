import { formatWithOptions } from "./formatting.js";
import { DEFAULT_OPTIONS, normalizeStoredOptions } from "./options-schema.js";

export async function formatForClipboard(
  markdown: string,
  title: string,
  url: string,
): Promise<string> {
  const storageArea = globalThis.chrome?.storage?.sync;
  if (!storageArea) {
    return formatWithOptions(DEFAULT_OPTIONS, { text: markdown, title, url });
  }

  try {
    const snapshot = await storageArea.get(["options", "format"]);
    const options = normalizeStoredOptions(snapshot);
    return formatWithOptions(options, { text: markdown, title, url });
  } catch (error) {
    console.error("Failed to retrieve formatting options, using defaults.", error);
    return formatWithOptions(DEFAULT_OPTIONS, { text: markdown, title, url });
  }
}
