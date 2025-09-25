import { formatForClipboard } from './clipboard.js';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'markquote',
    title: 'Copy as Markdown Quote',
    contexts: ['selection'],
  });

  chrome.contextMenus.create({
    id: 'markquote-options',
    title: 'Options',
    contexts: ['action'],
  });
});

function triggerCopy(tab: chrome.tabs.Tab | undefined) {
  if (!tab?.id) {
    return;
  }

  chrome.scripting.executeScript(
    {
      target: { tabId: tab.id },
      files: ['selection.js'],
    },
    () => {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError.message);
      }
    },
  );
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'markquote' && tab) {
    triggerCopy(tab);
  } else if (info.menuItemId === 'markquote-options') {
    chrome.runtime.openOptionsPage();
  }
});

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === 'copy-as-markdown-quote') {
    triggerCopy(tab);
  }
});

chrome.runtime.onMessage.addListener(async (request, sender, _sendResponse) => {
  console.log('Background script received message:', request);

  if (request?.type === 'request-selection-copy') {
    const tabs = await chrome.tabs.query({ lastFocusedWindow: true });
    const isHttpTab = (tab: chrome.tabs.Tab) => Boolean(tab.url?.startsWith('http'));
    const isExtensionTab = (tab: chrome.tabs.Tab) => tab.url?.startsWith('chrome-extension://');

    const targetTab =
      tabs.find((tab) => tab.active && isHttpTab(tab)) ??
      tabs.find((tab) => isHttpTab(tab)) ??
      tabs.find((tab) => !isExtensionTab(tab)) ??
      tabs[0];

    if (targetTab) {
      triggerCopy(targetTab);
    } else {
      console.warn('No tab found to trigger copy from popup request.');
    }
    return;
  }

  if (request.markdown) {
    console.log('Received Markdown:', request.markdown);
    const markdown = request.markdown;
    const title = sender.tab?.title || 'Page Title';
    const url = sender.tab?.url || 'https://example.com';
    const formatted = await formatForClipboard(markdown, title, url);
    console.log('Final formatted text:', formatted);

    await createOffscreenDocument();
    console.log('Sending to offscreen document for copying.');
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
