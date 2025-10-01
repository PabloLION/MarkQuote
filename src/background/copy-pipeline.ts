import { formatForClipboard } from "../clipboard.js";
import { isE2ETest } from "./constants.js";
import { ERROR_CONTEXT } from "./error-context.js";
import { recordError } from "./errors.js";
import type { CopySource } from "./types.js";

let lastFormattedPreview = "";
let lastPreviewError: string | undefined;

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

export function getLastFormattedPreview(): string {
  return lastFormattedPreview;
}

export function getLastPreviewError(): string | undefined {
  return lastPreviewError;
}

export function setLastPreviewError(message: string | undefined): void {
  lastPreviewError = message;
}
