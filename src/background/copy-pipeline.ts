/**
 * Helpers for formatting captured selections and relaying preview/error information back to the
 * popup. The module doubles as an instrumentation point for end-to-end tests.
 */
import { formatForClipboard } from "../clipboard.js";
import { isE2ETest } from "./constants.js";
import { ERROR_CONTEXT } from "./error-context.js";
import { recordError } from "./errors.js";
import type { CopySource } from "./types.js";

let lastFormattedPreview = "";
let lastPreviewError: string | undefined;

/**
 * Formats the captured markdown for clipboard usage. When the popup initiated the copy we notify it
 * with the formatted preview, falling back to default copy behaviour if the message fails.
 */
export async function runCopyPipeline(
  markdown: string,
  title: string,
  url: string,
  source: CopySource,
): Promise<string> {
  const formatted = await formatForClipboard(markdown, title, url);

  if (source === "popup") {
    chrome.runtime
      .sendMessage({ type: "copied-text-preview", text: formatted })
      .then(() => {
        if (isE2ETest) {
          lastPreviewError = undefined;
        }
      })
      .catch((error) => {
        void recordError(ERROR_CONTEXT.NotifyPopupPreview, error);
        if (isE2ETest) {
          lastPreviewError = error instanceof Error ? error.message : String(error);
        }
      });
  }

  if (isE2ETest) {
    lastFormattedPreview = formatted;
  }

  return formatted;
}

/** Returns the last formatted preview (test-only helper). */
export function getLastFormattedPreview(): string {
  return lastFormattedPreview;
}

/** Returns the last preview error encountered (test-only helper). */
export function getLastPreviewError(): string | undefined {
  return lastPreviewError;
}

/** Overrides the stored preview error (test helper used by E2E suite). */
export function setLastPreviewError(message: string | undefined): void {
  lastPreviewError = message;
}
