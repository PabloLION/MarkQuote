import type { BrowserContext } from "playwright";
import { waitForConfirmation } from "./helpers.js";
import { getViewportSize } from "./sizing.js";

const OVERVIEW_TARGET_SENTENCE =
  "This was addressed in 2014 when long-standing Markdown contributors released CommonMark, an unambiguous specification and test suite for Markdown.";

export async function captureOverviewScreenshot(
  context: BrowserContext,
  hotkey: string,
  outputPath: string,
  confirm: boolean,
): Promise<void> {
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
    .markquote-overlay-root {
      position: absolute;
      top: 0;
      left: 0;
      pointer-events: none;
      font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
      color: #0b1120;
      z-index: 999;
    }

    .markquote-context-menu {
      margin: 0;
      padding: 14px 0;
      list-style: none;
      width: 240px;
      background: rgba(249, 250, 251, 0.96);
      border-radius: 18px;
      box-shadow: 0 28px 70px rgba(15, 23, 42, 0.25);
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

    .markquote-callout {
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
    }

    .markquote-callout.context::after {
      border-right-color: rgba(251, 191, 36, 0.6);
      left: -16px;
      top: 24px;
    }

    .markquote-callout.hotkey::after {
      border-bottom-color: rgba(251, 191, 36, 0.6);
      left: 50%;
      transform: translateX(-50%);
      bottom: -16px;
    }
  `;

  await page.addStyleTag({ content: overlayCss });

  await page.evaluate(
    ({ hotkey, targetSentence }) => {
      const paragraphs = Array.from(document.querySelectorAll<HTMLElement>(".mw-parser-output p"));

      let selectionRange: Range | null = null;

      for (const paragraph of paragraphs) {
        const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
        const textNodes: Array<{ node: Text; start: number; end: number }> = [];
        let aggregate = "";

        let current = walker.nextNode() as Text | null;
        while (current) {
          const start = aggregate.length;
          aggregate += current.data;
          textNodes.push({ node: current, start, end: aggregate.length });
          current = walker.nextNode() as Text | null;
        }

        const matchIndex = aggregate.indexOf(targetSentence);
        if (matchIndex === -1) {
          continue;
        }

        const matchEnd = matchIndex + targetSentence.length;
        const startEntry = textNodes.find(
          (entry) => matchIndex >= entry.start && matchIndex < entry.end,
        );
        const endEntry = textNodes.find((entry) => matchEnd > entry.start && matchEnd <= entry.end);

        if (!startEntry || !endEntry) {
          console.warn("[MarkQuote overview capture] Unable to map highlight range to text nodes.");
          continue;
        }

        const range = document.createRange();
        range.setStart(startEntry.node, matchIndex - startEntry.start);
        range.setEnd(endEntry.node, matchEnd - endEntry.start);

        selectionRange = range;
        paragraph.scrollIntoView({ block: "center" });
        break;
      }

      if (document.body.style.position === "" || document.body.style.position === "static") {
        document.body.dataset.markquoteOriginalPosition = document.body.style.position;
        document.body.style.position = "relative";
      }

      const root = document.createElement("div");
      root.className = "markquote-overlay-root";

      const contextMenu = document.createElement("ul");
      contextMenu.className = "markquote-context-menu";
      contextMenu.innerHTML = `
        <li>Cut</li>
        <li>Copy</li>
        <li class="active">Copy as Markdown quote</li>
        <li>Paste</li>
      `;
      contextMenu.style.position = "absolute";
      contextMenu.style.visibility = "hidden";
      root.appendChild(contextMenu);

      const contextCallout = document.createElement("div");
      contextCallout.className = "markquote-callout context";
      contextCallout.textContent = 'Right-click → "Copy as Markdown quote"';
      contextCallout.style.position = "absolute";
      contextCallout.style.visibility = "hidden";
      root.appendChild(contextCallout);

      const hotkeyCallout = document.createElement("div");
      hotkeyCallout.className = "markquote-callout hotkey";
      hotkeyCallout.textContent = `Press ${hotkey} to copy instantly`;
      hotkeyCallout.style.position = "absolute";
      hotkeyCallout.style.visibility = "hidden";
      root.appendChild(hotkeyCallout);

      document.body.appendChild(root);

      if (!selectionRange) {
        console.error("[MarkQuote overview capture] Unable to find target sentence to highlight.");
      } else {
        const selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges();
          selection.addRange(selectionRange);
        }

        const selectionRect = selectionRange.getBoundingClientRect();
        const menuRect = contextMenu.getBoundingClientRect();
        const hotkeyRect = hotkeyCallout.getBoundingClientRect();
        const scrollX = window.scrollX;
        const scrollY = window.scrollY;

        const menuTop =
          scrollY + selectionRect.top + selectionRect.height / 2 - menuRect.height / 2;
        const menuLeft = scrollX + selectionRect.right + 40;
        contextMenu.style.top = `${Math.max(menuTop, scrollY + 24)}px`;
        contextMenu.style.left = `${menuLeft}px`;
        contextMenu.style.visibility = "visible";

        const contextTop = scrollY + selectionRect.bottom + 16;
        contextCallout.style.top = `${contextTop}px`;
        contextCallout.style.left = `${menuLeft}px`;
        contextCallout.style.visibility = "visible";
        contextCallout.style.transform = "translateX(0)";

        const hotkeyTop = scrollY + selectionRect.top - hotkeyRect.height - 16;
        const hotkeyLeft =
          scrollX + selectionRect.left + selectionRect.width / 2 - hotkeyRect.width / 2;
        hotkeyCallout.style.top = `${Math.max(hotkeyTop, scrollY + 24)}px`;
        hotkeyCallout.style.left = `${hotkeyLeft}px`;
        hotkeyCallout.style.visibility = "visible";
      }
    },
    {
      hotkey,
      targetSentence: OVERVIEW_TARGET_SENTENCE,
    },
  );

  await waitForConfirmation("Review overview composition", confirm);
  await page.screenshot({ path: outputPath });
  await page.close();
}
