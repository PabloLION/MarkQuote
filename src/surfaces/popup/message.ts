import type { PopupDom } from "./dom.js";

export type MessageVariant = "default" | "success" | "warning";

export interface MessageOptions {
  label?: string;
  variant?: MessageVariant;
}

export interface MessageController {
  set(text: string, options?: MessageOptions): void;
  clear(): void;
}

export function createMessageController(dom: PopupDom): MessageController {
  const { message, messageText } = dom;

  const controller: MessageController = {
    set(text, options = {}) {
      const normalized = text.trim();

      if (normalized.length === 0) {
        messageText.textContent = "";
        message.setAttribute("hidden", "true");
      } else {
        messageText.textContent = text;
        message.removeAttribute("hidden");
      }

      if (options.label) {
        message.dataset.label = options.label;
      } else {
        delete message.dataset.label;
      }

      const variant = options.variant ?? "default";
      if (variant === "default") {
        delete message.dataset.variant;
      } else {
        message.dataset.variant = variant;
      }
    },
    clear() {
      controller.set("");
    },
  };

  return controller;
}
