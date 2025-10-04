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

    const success = await copyMarkdownToClipboard(text);
    if (!success) {
      deps.messages.set("Unable to copy automatically. Text is ready below.", {
        variant: "warning",
      });
    }
  }

  function handleCopyProtected(): void {
    deps.preview.clear();
    deps.messages.set(PROTECTED_STATUS_MESSAGE, { label: "Protected", variant: "warning" });
  }

  async function handleMessage(message: RuntimeMessage): Promise<boolean> {
    if (message.type === "copied-text-preview") {
      await handleCopiedPreview(message.text);
      return true;
    }

    if (message.type === "copy-protected") {
      handleCopyProtected();
      return true;
    }

    return false;
  }

  return {
    handleMessage,
  };
}
