import type { PopupDom } from "./dom.js";

export interface PreviewController {
  render(text: string | null | undefined): void;
  clear(): void;
}

export function createPreviewController(dom: PopupDom): PreviewController {
  const { preview, previewCode } = dom;
  /* v8 ignore next - previewCode element always exists in test DOM; fallback handles malformed popup HTML */
  const target = previewCode ?? preview;

  const controller: PreviewController = {
    render(text) {
      if (typeof text !== "string" || text.trim().length === 0) {
        if (previewCode) {
          previewCode.textContent = "";
          /* v8 ignore next 3 - previewCode always exists in test DOM; fallback handles malformed popup HTML */
        } else {
          preview.textContent = "";
        }
        preview.hidden = true;
        return;
      }

      target.textContent = text;
      preview.hidden = false;
    },
    clear() {
      controller.render(null);
    },
  };

  return controller;
}
