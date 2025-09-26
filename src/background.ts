import { formatForClipboard } from './clipboard.js';
import {
  DEFAULT_OPTIONS,
  CURRENT_OPTIONS_VERSION,
  normalizeStoredOptions,
  type OptionsPayload,
} from './options-schema.js';

const DEFAULT_TITLE = 'Page Title';
const DEFAULT_URL = 'https://example.com';
const E2E_SELECTION_MESSAGE = 'e2e:selection';
const E2E_LAST_FORMATTED_MESSAGE = 'e2e:get-last-formatted';
const E2E_SET_OPTIONS_MESSAGE = 'e2e:set-options';
const isE2ETest = (import.meta.env?.VITE_E2E ?? '').toLowerCase() === 'true';
let lastFormattedPreview = '';
let lastPreviewError: string | undefined;
let e2eSelectionStub:
  | {
      markdown: string;
      title: string;
      url: string;
    }
  | undefined;

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
        if (isE2ETest) {
          lastPreviewError = chrome.runtime.lastError.message;
        }
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
  const formatted = await formatForClipboard(markdown, title, url);

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

async function persistOptions(payload: OptionsPayload): Promise<void> {
  const storageArea = chrome.storage?.sync;
  if (!storageArea) {
    console.warn('chrome.storage.sync is unavailable; cannot persist options.');
    return;
  }

  const normalized = normalizeStoredOptions({ options: payload });
  await storageArea.set({
    options: normalized,
    format: normalized.format,
    titleRules: normalized.titleRules,
    urlRules: normalized.urlRules,
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background script received message:', request, { isE2ETest });

  if (request?.type === 'request-selection-copy') {
    if (isE2ETest && e2eSelectionStub) {
      const stub = e2eSelectionStub;
      e2eSelectionStub = undefined;
      void runCopyPipeline(stub.markdown, stub.title, stub.url).catch((error) => {
        console.error('Failed to process E2E stub selection.', error);
      });
      sendResponse?.({ ok: true });
      return true;
    }

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

  if (isE2ETest && request?.type === E2E_SET_OPTIONS_MESSAGE) {
    const candidate = request.options as OptionsPayload | undefined;
    if (!candidate) {
      console.warn('E2E set-options message missing payload.');
      sendResponse?.({ ok: false });
      return false;
    }

    void persistOptions({
      ...candidate,
      version: CURRENT_OPTIONS_VERSION,
    })
      .then(() => {
        sendResponse?.({ ok: true });
      })
      .catch((error) => {
        console.error('Failed to persist options via E2E message.', error);
        sendResponse?.({ ok: false, error: error instanceof Error ? error.message : String(error) });
      });
    return true;
  }

  if (isE2ETest && request?.type === E2E_LAST_FORMATTED_MESSAGE) {
    sendResponse?.({ formatted: lastFormattedPreview, error: lastPreviewError });
    return true;
  }

  if (isE2ETest && request?.type === 'e2e:prime-selection') {
    const markdown = typeof request.markdown === 'string' ? request.markdown : '';
    const title = typeof request.title === 'string' && request.title ? request.title : DEFAULT_TITLE;
    const url = typeof request.url === 'string' && request.url ? request.url : DEFAULT_URL;

    if (!markdown) {
      sendResponse?.({ ok: false, error: 'Missing markdown payload for stub selection.' });
      return false;
    }

    e2eSelectionStub = { markdown, title, url };
    sendResponse?.({ ok: true });
    return true;
  }

  if (request.markdown) {
    const title = sender.tab?.title || DEFAULT_TITLE;
    const url = sender.tab?.url || DEFAULT_URL;
    void runCopyPipeline(request.markdown, title, url);
  }
});
