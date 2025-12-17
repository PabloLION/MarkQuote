import { MESSAGE_TYPE } from "../../../lib/constants.js";
import { copyMarkdownToClipboard } from "../clipboard.js";
import type { MessageController } from "../message.js";
import type { PreviewController } from "../preview.js";
import { COPIED_STATUS_MESSAGE, PROTECTED_STATUS_MESSAGE, type RuntimeMessage } from "../state.js";

export interface CopyFlowDeps {
  preview: PreviewController;
  messages: MessageController;
}

export interface CopyFlow {
  handleMessage: (message: RuntimeMessage) => Promise<boolean>;
}

export function createCopyFlow(deps: CopyFlowDeps): CopyFlow {
  async function handleCopiedPreview(text: string): Promise<void> {
    deps.preview.render(text);
    deps.messages.set(COPIED_STATUS_MESSAGE, { label: "Copied", variant: "success" });

    let success = false;
    let failureReason: string | undefined;
    let failureName: string | undefined;

    try {
      success = await copyMarkdownToClipboard(text);
    } catch (error) {
      if (error instanceof DOMException) {
        failureName = error.name;
        /* v8 ignore next - DOMException.message always populated in JSDOM; real browsers may have empty message */
        failureReason = error.message || error.name;
      } else {
        /* v8 ignore next 3 - clipboard API only throws DOMException in tests; non-DOMException path handles edge cases */
        const normalized = error instanceof Error ? error : new Error(String(error));
        failureName = normalized.name;
        failureReason = normalized.message;
      }
    }

    if (!success) {
      let message = "Unable to copy automatically. Text is ready below.";
      if (failureName === "NotAllowedError") {
        message = "Clipboard permission denied. Copy manually below.";
      } else if (failureName === "QuotaExceededError") {
        message = "Clipboard quota exceeded. Copy manually below.";
      } else if (failureReason || failureName) {
        console.warn("[MarkQuote] Clipboard copy failed", {
          name: failureName,
          reason: failureReason,
        });
      }
      deps.messages.set(message, {
        variant: "warning",
      });
    }
  }

  function handleCopyProtected(): void {
    deps.preview.clear();
    deps.messages.set(PROTECTED_STATUS_MESSAGE, { label: "Protected", variant: "warning" });
  }

  async function handleMessage(message: RuntimeMessage): Promise<boolean> {
    if (message.type === MESSAGE_TYPE.COPIED_TEXT_PREVIEW) {
      await handleCopiedPreview(message.text);
      return true;
    }

    if (message.type === MESSAGE_TYPE.COPY_PROTECTED) {
      handleCopyProtected();
      return true;
    }

    return false;
  }

  return {
    handleMessage,
  };
}
