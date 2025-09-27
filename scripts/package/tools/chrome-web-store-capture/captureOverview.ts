import type { BrowserContext } from "playwright";
import { toDataUri, waitForConfirmation } from "./helpers.js";
import { getViewportSize } from "./sizing.js";

export async function captureOverviewScreenshot(
  context: BrowserContext,
  popupBuffer: Buffer,
  iconBuffer: Buffer,
  hotkey: string,
  outputPath: string,
  confirm: boolean,
): Promise<void> {
  const popupDataUri = toDataUri(popupBuffer);
  const iconDataUri = toDataUri(iconBuffer);

  const viewport = getViewportSize("overview");
  const page = await context.newPage();
  await page.setViewportSize(viewport);
  await page.goto("https://en.wikipedia.org/wiki/Markdown", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
  await page.waitForTimeout(500);

  const overlayCss = `
    .markquote-highlight {
      background: rgba(26, 115, 232, 0.22);
      box-shadow: 0 0 0 6px rgba(26, 115, 232, 0.18);
      border-radius: 6px;
    }

    .markquote-overlay-root {
      position: fixed;
      inset: 0;
      pointer-events: none;
      font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
      color: #0b1120;
    }

    .markquote-context-menu {
      position: absolute;
      top: 280px;
      left: 140px;
      width: 220px;
      background: rgba(249, 250, 251, 0.96);
      border-radius: 18px;
      box-shadow: 0 28px 70px rgba(15, 23, 42, 0.25);
      padding: 14px 0;
      list-style: none;
      font-size: 15px;
    }

    .markquote-context-menu li {
      padding: 6px 18px;
      color: #374151;
    }

    .markquote-context-menu li.active {
      background: rgba(26, 115, 232, 0.14);
      color: #0b2b64;
      font-weight: 600;
    }

    .markquote-toolbar-icon {
      position: absolute;
      top: 20px;
      right: 40px;
      width: 46px;
      height: 46px;
      border-radius: 14px;
      background: rgba(8, 25, 61, 0.85);
      display: grid;
      place-items: center;
      box-shadow: 0 20px 50px rgba(8, 25, 61, 0.35);
    }

    .markquote-toolbar-icon img {
      width: 24px;
      height: 24px;
    }

    .markquote-popup-preview {
      position: absolute;
      top: 160px;
      right: 70px;
      width: 320px;
      border-radius: 22px;
      overflow: hidden;
      box-shadow: 0 28px 70px rgba(15, 23, 42, 0.4);
    }

    .markquote-popup-preview img {
      width: 100%;
      display: block;
      border-radius: 22px;
    }

    .markquote-callout {
      position: absolute;
      background: rgba(255, 255, 255, 0.96);
      border: 1px solid rgba(251, 191, 36, 0.6);
      border-radius: 16px;
      box-shadow: 0 20px 45px rgba(251, 191, 36, 0.25);
      padding: 12px 16px;
      width: 220px;
      font-size: 14px;
      line-height: 1.45;
    }

    .markquote-callout::after {
      content: '';
      position: absolute;
      width: 0;
      height: 0;
      border: 8px solid transparent;
      border-top-color: rgba(251, 191, 36, 0.6);
      bottom: -16px;
      left: 24px;
    }

    .markquote-callout.context {
      top: 230px;
      left: 150px;
    }

    .markquote-callout.popup {
      top: 140px;
      right: 360px;
    }

    .markquote-callout.hotkey {
      bottom: 140px;
      right: 140px;
    }
  `;

  await page.addStyleTag({ content: overlayCss });

  await page.evaluate(
    ({ popup, icon, hotkey }) => {
      const paragraph = document.querySelector(".mw-parser-output p");
      if (paragraph) {
        const match = paragraph.innerHTML.match(
          /(GitHub, Stack Overflow, and other platforms[^.]+\.)/i,
        );
        if (match) {
          paragraph.innerHTML = paragraph.innerHTML.replace(
            match[1],
            `<span class="markquote-highlight">${match[1]}</span>`,
          );
        }
      }

      const root = document.createElement("div");
      root.className = "markquote-overlay-root";

      const toolbar = document.createElement("div");
      toolbar.className = "markquote-toolbar-icon";
      toolbar.innerHTML = `<img src="${icon}" alt="MarkQuote icon" />`;
      root.appendChild(toolbar);

      const popupFrame = document.createElement("div");
      popupFrame.className = "markquote-popup-preview";
      popupFrame.innerHTML = `<img src="${popup}" alt="MarkQuote popup" />`;
      root.appendChild(popupFrame);

      const contextMenu = document.createElement("ul");
      contextMenu.className = "markquote-context-menu";
      contextMenu.innerHTML = `
        <li>Cut</li>
        <li>Copy</li>
        <li class="active">Copy as Markdown quote</li>
        <li>Paste</li>
      `;
      root.appendChild(contextMenu);

      const contextCallout = document.createElement("div");
      contextCallout.className = "markquote-callout context";
      contextCallout.textContent = 'Right-click → "Copy as Markdown quote"';
      root.appendChild(contextCallout);

      const popupCallout = document.createElement("div");
      popupCallout.className = "markquote-callout popup";
      popupCallout.textContent = "Toolbar popup shows the Markdown preview";
      root.appendChild(popupCallout);

      const hotkeyCallout = document.createElement("div");
      hotkeyCallout.className = "markquote-callout hotkey";
      hotkeyCallout.textContent = `Press ${hotkey} to copy instantly`;
      root.appendChild(hotkeyCallout);

      document.body.appendChild(root);
    },
    {
      popup: popupDataUri,
      icon: iconDataUri,
      hotkey,
    },
  );

  await waitForConfirmation("Review overview composition", confirm);
  await page.screenshot({ path: outputPath });
  await page.close();
}
