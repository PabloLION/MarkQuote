import type { MessageController } from "./message.js";
import type { PreviewController } from "./preview.js";
import {
  COPIED_STATUS_MESSAGE,
  DEFAULT_STATUS_MESSAGE,
  type ForcedPopupState,
  type PopupDevPreviewApi,
  PROTECTED_STATUS_MESSAGE,
  SAMPLE_PREVIEW,
} from "./state.js";

export function resolveForcedPopupState(): ForcedPopupState | null {
  const isDev = window.location.hostname === "localhost" || window.location.port === "5173";
  if (!isDev) {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const stateParam = params.get("state");

  if (!stateParam) {
    return null;
  }

  const normalized = stateParam.trim().toLowerCase();

  if (normalized === "default") {
    return { kind: "default" };
  }

  if (normalized === "protected") {
    return { kind: "protected" };
  }

  if (normalized === "copied") {
    const previewParam = params.get("preview");
    const preview = previewParam?.trim().length ? previewParam : SAMPLE_PREVIEW;
    return { kind: "copied", preview };
  }

  return null;
}

export function applyForcedPopupState(
  state: ForcedPopupState,
  preview: PreviewController,
  messages: MessageController,
): void {
  switch (state.kind) {
    case "default":
      preview.clear();
      messages.set(DEFAULT_STATUS_MESSAGE, { label: "Tip" });
      break;
    case "copied":
      preview.render(state.preview);
      messages.set(COPIED_STATUS_MESSAGE, { label: "Copied", variant: "success" });
      break;
    case "protected":
      preview.clear();
      messages.set(PROTECTED_STATUS_MESSAGE, { label: "Protected", variant: "warning" });
      break;
    default:
      preview.clear();
      messages.set(DEFAULT_STATUS_MESSAGE, { label: "Tip" });
  }
}

export function createDevPreviewApi(
  preview: PreviewController,
  messages: MessageController,
): PopupDevPreviewApi {
  return {
    showDefault() {
      preview.clear();
      messages.set(DEFAULT_STATUS_MESSAGE, { label: "Tip" });
    },
    showSuccess(text: string) {
      preview.render(text);
      messages.set(COPIED_STATUS_MESSAGE, { label: "Copied", variant: "success" });
    },
    showProtected() {
      preview.clear();
      messages.set(PROTECTED_STATUS_MESSAGE, { label: "Protected", variant: "warning" });
    },
  } satisfies PopupDevPreviewApi;
}
