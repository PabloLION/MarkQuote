import { formatForClipboard } from './clipboard.js';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "markquote",
    title: "Copy as Markdown Quote",
    contexts: ["selection"],
  });

  chrome.contextMenus.create({
    id: "markquote-options",
    title: "Options",
    contexts: ["action"],
  });
});

function triggerCopy(tab: chrome.tabs.Tab) {
  if (tab.id) {
    chrome.scripting.executeScript(
      {
        target: { tabId: tab.id },
        files: ['selection.js'],
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
  } else if (info.menuItemId === "markquote-options") {
    chrome.runtime.openOptionsPage();
  }
});

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === 'copy-as-markdown-quote') {
    const showPopupAfterCopy = false; // Placeholder for future functionality
    triggerCopy(tab);
  }
});

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  console.log("Background script received message:", request);
  if (request.markdown) {
    console.log("Received Markdown:", request.markdown);
    const markdown = request.markdown;
    const title = sender.tab?.title || 'Page Title';
    const url = sender.tab?.url || 'https://example.com';
    const formatted = await formatForClipboard(markdown, title, url);
    console.log("Final formatted text:", formatted);

    await createOffscreenDocument();
    console.log("Sending to offscreen document for copying.");
    chrome.runtime.sendMessage({ type: 'copy-to-clipboard', text: formatted });

    // Send the formatted text to the popup for preview
    chrome.runtime.sendMessage({ type: 'copied-text-preview', text: formatted });
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
