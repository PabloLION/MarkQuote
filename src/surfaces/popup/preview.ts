import type { PopupDom } from "./dom.js";

export interface PreviewController {
  render(text: string | null | undefined): void;
  clear(): void;
}

export function createPreviewController(dom: PopupDom): PreviewController {
  const { preview, previewCode } = dom;
  const target = previewCode ?? preview;

  const controller: PreviewController = {
    render(text) {
      if (typeof text !== "string" || text.trim().length === 0) {
        if (previewCode) {
          previewCode.textContent = "";
        } else {
          preview.textContent = "";
        }
        preview.hidden = true;
        preview.setAttribute("hidden", "true");
        return;
      }

      target.textContent = text;
      preview.hidden = false;
      preview.removeAttribute("hidden");
    },
    clear() {
      controller.render(null);
    },
  };

  return controller;
}
