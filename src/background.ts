import { formatForClipboard } from './clipboard.js';

const DEFAULT_TITLE = 'Page Title';
const DEFAULT_URL = 'https://example.com';
const E2E_SELECTION_MESSAGE = 'e2e:selection';
const E2E_LAST_FORMATTED_MESSAGE = 'e2e:get-last-formatted';
const isE2ETest = (import.meta.env?.VITE_E2E ?? '').toLowerCase() === 'true';
let lastFormattedPreview = '';
let lastPreviewError: string | undefined;

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

async function runCopyPipeline(markdown: string, title: string, url: string): Promise<string> {
  console.log('Formatting markdown for clipboard.', { title, url });
  const formatted = await formatForClipboard(markdown, title, url);
  console.log('Final formatted text:', formatted);

  try {
    await createOffscreenDocument();
    console.log('Sending to offscreen document for copying.');
    chrome.runtime.sendMessage({ type: 'copy-to-clipboard', text: formatted });
  } catch (error) {
    console.warn('Unable to create offscreen document for clipboard writes.', error);
  }

  chrome.runtime
    .sendMessage({ type: 'copied-text-preview', text: formatted })
    .then(() => {
      if (isE2ETest) {
        lastPreviewError = undefined;
      }
    })
    .catch((error) => {
      console.warn('Failed to notify popup preview.', error);
      if (isE2ETest) {
        lastPreviewError = error instanceof Error ? error.message : String(error);
      }
    });

  if (isE2ETest) {
    lastFormattedPreview = formatted;
  }

  return formatted;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background script received message:', request, { isE2ETest });

  if (request?.type === 'request-selection-copy') {
    void chrome.tabs
      .query({ lastFocusedWindow: true })
      .then((tabs) => {
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
      })
      .catch((error) => {
        console.error('Failed to query tabs for selection copy.', error);
      });
    return false;
  }

  if (isE2ETest && request?.type === E2E_SELECTION_MESSAGE) {
    if (typeof request.markdown !== 'string' || !request.markdown) {
      console.warn('E2E selection message missing markdown payload.');
      return false;
    }

    const title = typeof request.title === 'string' && request.title ? request.title : DEFAULT_TITLE;
    const url = typeof request.url === 'string' && request.url ? request.url : DEFAULT_URL;
    void runCopyPipeline(request.markdown, title, url).then((formatted) => {
      sendResponse?.({ formatted });
    });
    return true;
  }

  if (isE2ETest && request?.type === E2E_LAST_FORMATTED_MESSAGE) {
    sendResponse?.({ formatted: lastFormattedPreview, error: lastPreviewError });
    return true;
  }

  if (request.markdown) {
    console.log('Received Markdown:', request.markdown);
    const title = sender.tab?.title || DEFAULT_TITLE;
    const url = sender.tab?.url || DEFAULT_URL;
    void runCopyPipeline(request.markdown, title, url);
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
