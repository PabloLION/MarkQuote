import type { OptionsContext } from "./context.js";
import { STATUS_TIMEOUT_MS } from "./state.js";

export function showStatus(
  context: OptionsContext,
  message: string,
  variant: "success" | "error" = "success",
): void {
  const { statusElement } = context.dom;
  statusElement.textContent = message;
  statusElement.dataset.variant = variant;
  statusElement.hidden = false;

  if (context.statusTimeout) {
    clearTimeout(context.statusTimeout);
  }
  context.statusTimeout = setTimeout(() => hideStatus(context), STATUS_TIMEOUT_MS);
}

export function hideStatus(context: OptionsContext): void {
  const { statusElement } = context.dom;
  statusElement.textContent = "";
  statusElement.removeAttribute("data-variant");
  statusElement.hidden = true;
}
