import { convertHtmlToMarkdown } from './converter';
import { formatForClipboard } from './clipboard';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "markquote",
    title: "Copy as Markdown Quote",
    contexts: ["selection"],
  });
});

function triggerCopy(tab: chrome.tabs.Tab) {
  if (tab.id) {
    chrome.scripting.executeScript(
      {
        target: { tabId: tab.id },
        files: ['dist/selection.js'],
      },
      () => {
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError.message);
        }
      }
    );
  }
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "markquote" && tab) {
    triggerCopy(tab);
  }
});

chrome.action.onClicked.addListener((tab) => {
  triggerCopy(tab);
});

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.html) {
    const markdown = convertHtmlToMarkdown(request.html);
    const title = sender.tab?.title || 'Page Title';
    const url = sender.tab?.url || 'https://example.com';
    const formatted = formatForClipboard(markdown, title, url);

    await createOffscreenDocument();
    chrome.runtime.sendMessage({ type: 'copy-to-clipboard', text: formatted });
  }
});

async function createOffscreenDocument() {
  if (await chrome.offscreen.hasDocument()) {
    return;
  }
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: [chrome.offscreen.Reason.CLIPBOARD],
    justification: 'Needed to copy text to the clipboard',
  });
}
