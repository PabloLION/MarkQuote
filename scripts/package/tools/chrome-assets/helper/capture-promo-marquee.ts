import type { BrowserContext } from "playwright";
import { formatHotkeyHtml, renderTemplate, toDataUri } from "./helpers.js";
import { getViewportSize } from "./sizing.js";

export async function capturePromoMarquee(
  context: BrowserContext,
  popupBuffer: Buffer,
  iconBuffer: Buffer,
  hotkey: string,
  outputPath: string,
  confirm: boolean,
): Promise<void> {
  await renderTemplate(
    context,
    "promo-marquee.html",
    {
      POPUP_IMAGE: toDataUri(popupBuffer),
      ICON: toDataUri(iconBuffer),
      HOTKEY: hotkey,
      HOTKEY_HTML: formatHotkeyHtml(hotkey),
    },
    getViewportSize("promoMarquee"),
    outputPath,
    confirm,
    "Review marquee promo tile",
  );
}
