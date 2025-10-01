import type { BrowserContext, Page } from "playwright";
import { undockDevtools } from "./extension.js";

const OVERVIEW_TARGET_SENTENCE =
  "This was addressed in 2014 when long-standing Markdown contributors released CommonMark, an unambiguous specification and test suite for Markdown.";

const OVERLAY_CSS = `
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
    background: rgba(249, 250, 251, 0.8);
    border-radius: 18px;
    box-shadow: 0 28px 70px rgba(15, 23, 42, 0.25);
  }

  .markquote-context-menu li {
    padding: 6px 18px;
    color: #374151;
  }

  .markquote-context-menu li.active {
    background: rgba(251, 191, 36, 0.32);
    color: #0b1120;
    font-weight: 700;
    box-shadow: inset 0 0 0 1px rgba(234, 179, 8, 0.65);
  }

  .markquote-callout {
    background: rgba(255, 255, 255, 0.9);
    border: 2px solid rgba(251, 191, 36, 0.75);
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
    border: 10px solid transparent;
  }

  .markquote-callout.context::after {
    border-bottom-color: rgba(251, 191, 36, 0.75);
    left: 50%;
    transform: translateX(-50%);
    top: -20px;
  }

  .markquote-callout.hotkey::after {
    border-top-color: rgba(251, 191, 36, 0.75);
    left: 50%;
    transform: translateX(-50%);
    top: 100%;
  }

  .markquote-callout.toolbar::after {
    border-bottom-color: rgba(251, 191, 36, 0.75);
    left: 50%;
    transform: translateX(-50%);
    top: -20px;
  }

  .markquote-callout.hotkey kbd,
  .markquote-callout.toolbar kbd,
  .markquote-callout.context kbd {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 6px;
    background: rgba(15, 23, 42, 0.85);
    color: #fff;
    font-weight: 600;
    font-size: 12px;
    box-shadow: inset 0 -2px 0 rgba(255, 255, 255, 0.2);
    margin: 0 2px;
  }

  .markquote-key-plus {
    display: inline-block;
    margin: 0 4px;
    color: rgba(15, 23, 42, 0.65);
    font-weight: 700;
  }

  .markquote-hotkey-note {
    display: inline-block;
    margin-left: 6px;
    font-size: 12px;
    font-weight: 600;
    color: rgba(15, 23, 42, 0.7);
  }

  .markquote-highlight {
    background: rgba(251, 191, 36, 0.25);
    box-shadow: 0 0 0 4px rgba(251, 191, 36, 0.2);
    border-radius: 6px;
    transition: background 0.2s ease;
  }

  .markquote-copy-heading {
    position: absolute;
    top: 600px;
    left: 96px;
    padding: 18px 36px;
    border-radius: 999px;
    background: linear-gradient(135deg, rgba(251, 191, 36, 0.95), rgba(253, 224, 71, 0.95));
    border: 3px solid rgba(234, 179, 8, 0.9);
    color: #0b1120;
    font-size: 24px;
    letter-spacing: 0.14em;
    font-weight: 800;
    text-transform: uppercase;
    text-shadow: 0 2px 6px rgba(15, 23, 42, 0.35);
    box-shadow: 0 26px 60px rgba(251, 191, 36, 0.45);
    white-space: nowrap;
  }
`;

export async function captureOverviewScreenshot(
  context: BrowserContext,
  hotkey: string,
): Promise<Page> {
  const page = await context.newPage();
  await navigateToMarkdown(page);
  await ensureAutomaticTheme(page);
  await page.addStyleTag({ content: OVERLAY_CSS });
  await injectOverlay(page, hotkey);
  return page;
}

async function navigateToMarkdown(page: Page): Promise<void> {
  await page.goto("https://en.wikipedia.org/wiki/Markdown", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
  await page.waitForTimeout(500);
  await undockDevtools(page).catch(() => {});
}

async function ensureAutomaticTheme(page: Page): Promise<void> {
  await page
    .waitForSelector('input[name="mw-color-scheme"][value="auto"]', {
      timeout: 5_000,
    })
    .catch(() => {
      console.warn("[MarkQuote overview capture] Unable to find Wikipedia color scheme toggle.");
    });

  await page.evaluate(() => {
    const colorToggle = document.querySelector<HTMLButtonElement>("#vector-appearance-toggle");

    if (colorToggle && colorToggle.getAttribute("aria-expanded") !== "true") {
      colorToggle.click();
    }

    const autoSelectors = [
      "#skin-client-pref-skin-theme-value-os",
      'input[name="mw-color-scheme"][value="auto"]',
    ];

    let autoRadio: HTMLInputElement | null = null;

    for (const selector of autoSelectors) {
      autoRadio = document.querySelector<HTMLInputElement>(selector);
      if (autoRadio) {
        break;
      }
    }

    if (!autoRadio) {
      console.warn(
        "[MarkQuote overview capture] Unable to find Wikipedia color scheme radio button.", // DO NOT REMOVE: essential for debugging color scheme automation.
      );
    }

    if (autoRadio) {
      if (!autoRadio.checked) {
        autoRadio.click();
      }
    } else {
      document.documentElement.setAttribute("data-mw-color-scheme", "auto");
    }
  });
}

async function injectOverlay(page: Page, hotkey: string): Promise<void> {
  await page.evaluate(setupOverviewOverlay, {
    hotkey,
    targetSentence: OVERVIEW_TARGET_SENTENCE,
  });
}

function setupOverviewOverlay(params: { hotkey: string; targetSentence: string }) {
  const { hotkey, targetSentence } = params;

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

    const wrapper = document.createElement("span");
    wrapper.className = "markquote-highlight";

    try {
      range.surroundContents(wrapper);
    } catch (error) {
      console.warn("Unable to wrap highlight span", error);
    }

    const newRange = document.createRange();
    newRange.selectNodeContents(wrapper);
    selectionRange = newRange;
    paragraph.scrollIntoView({ block: "center" });
    break;
  }

  ensureBodyPositioned();
  const root = buildOverlayRoot();
  document.body.appendChild(root);

  if (!selectionRange) {
    console.error("[MarkQuote overview capture] Unable to find target sentence to highlight.");
    return;
  }

  const selection = window.getSelection();
  if (selection) {
    selection.removeAllRanges();
    selection.addRange(selectionRange);
  }

  positionOverlayElements(root, selectionRange, hotkey);
}

function ensureBodyPositioned(): void {
  if (document.body.style.position === "" || document.body.style.position === "static") {
    document.body.dataset.markquoteOriginalPosition = document.body.style.position;
    document.body.style.position = "relative";
  }
}

function buildOverlayRoot(): HTMLElement {
  const root = document.createElement("div");
  root.className = "markquote-overlay-root";

  root.appendChild(createContextMenu());
  root.appendChild(createCallout("context", "Context menu → Copy as Markdown quote"));
  root.appendChild(createCallout("toolbar", "Toolbar icon → Copy preview"));
  root.appendChild(createHotkeyCallout());

  const heading = document.createElement("div");
  heading.className = "markquote-copy-heading";
  heading.textContent = "Three ways to copy";
  root.appendChild(heading);

  return root;
}

function createContextMenu(): HTMLElement {
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
  return contextMenu;
}

function createCallout(kind: "context" | "toolbar", text: string): HTMLElement {
  const callout = document.createElement("div");
  callout.className = `markquote-callout ${kind}`;
  callout.textContent = text;
  callout.style.position = "absolute";
  callout.style.visibility = "hidden";
  return callout;
}

function createHotkeyCallout(): HTMLElement {
  const callout = document.createElement("div");
  callout.className = "markquote-callout hotkey";
  callout.style.position = "absolute";
  callout.style.visibility = "hidden";
  return callout;
}

function positionOverlayElements(root: HTMLElement, range: Range, hotkey: string): void {
  const contextMenu = root.querySelector<HTMLElement>(".markquote-context-menu");
  const contextCallout = root.querySelector<HTMLElement>(".markquote-callout.context");
  const toolbarCallout = root.querySelector<HTMLElement>(".markquote-callout.toolbar");
  const hotkeyCallout = root.querySelector<HTMLElement>(".markquote-callout.hotkey");

  if (!contextMenu || !contextCallout || !toolbarCallout || !hotkeyCallout) {
    return;
  }

  hotkeyCallout.innerHTML = buildHotkeyMarkup(hotkey);

  const selectionRect = range.getBoundingClientRect();
  const menuRect = contextMenu.getBoundingClientRect();
  const hotkeyRect = hotkeyCallout.getBoundingClientRect();
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;

  const menuTop = scrollY + selectionRect.top + selectionRect.height / 2 - menuRect.height / 2;
  const menuLeft = scrollX + selectionRect.right + 40;
  contextMenu.style.top = `${Math.max(menuTop, scrollY + 24)}px`;
  contextMenu.style.left = `${menuLeft}px`;
  contextMenu.style.visibility = "visible";

  const contextTop = scrollY + selectionRect.bottom + 16;
  contextCallout.style.top = `${contextTop}px`;
  contextCallout.style.left = `${menuLeft}px`;
  contextCallout.style.visibility = "visible";

  const hotkeyTop = scrollY + selectionRect.top - hotkeyRect.height - 16;
  const hotkeyLeft = scrollX + selectionRect.left + selectionRect.width / 2 - hotkeyRect.width / 2;
  hotkeyCallout.style.top = `${Math.max(hotkeyTop, scrollY + 24)}px`;
  hotkeyCallout.style.left = `${hotkeyLeft}px`;
  hotkeyCallout.style.visibility = "visible";

  toolbarCallout.style.top = "848px";
  toolbarCallout.style.left = "996px";
  toolbarCallout.style.visibility = "visible";
}

function buildHotkeyMarkup(hotkey: string): string {
  const standardMarkup = hotkey
    .split("+")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => `<kbd>${segment}</kbd>`)
    .join('<span class="markquote-key-plus">+</span>');

  const macHotkeyMarkup = [
    { symbol: "⌥", label: "Option" },
    { symbol: "C", label: "C" },
  ]
    .map((segment) => `<kbd aria-label="${segment.label}">${segment.symbol}</kbd>`)
    .join('<span class="markquote-key-plus">+</span>');

  return `
    <div>Windows/Linux: ${standardMarkup}</div>
    <div>macOS: ${macHotkeyMarkup} <span class="markquote-hotkey-note">copy instantly</span></div>
  `;
}
