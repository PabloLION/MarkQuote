type CopiedTextMessage = {
  type: 'copied-text-preview';
  text: string;
};

const FEEDBACK_URL = 'https://github.com/PabloLION/MarkQuote';
const INLINE_MODE_DISCUSSION_URL =
  'https://github.com/PabloLION/MarkQuote/issues?q=is%3Aissue+inline+mode';

export function initializePopup(): () => void {
  const messageDiv = document.getElementById('message');
  const previewDiv = document.getElementById('preview');
  const optionsButton = document.getElementById('options-button');
  const hotkeysButton = document.getElementById('hotkeys-button');
  const feedbackButton = document.getElementById('feedback-button');
  const inlineModeButton = document.getElementById('inline-mode-button');

  if (!chrome?.runtime) {
    console.warn('chrome.runtime is unavailable; popup interactions are limited.');
    return () => {};
  }

  const messageListener = (request: CopiedTextMessage) => {
    if (request.type === 'copied-text-preview') {
      if (messageDiv) {
        messageDiv.textContent = 'Copied!';
      }
      if (previewDiv) {
        previewDiv.textContent = request.text;
      }
    }
  };

  chrome.runtime.onMessage.addListener(messageListener);

  const openOptions = () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
      return;
    }

    window.open('options.html', '_blank');
  };

  const openShortcuts = () => {
    if (chrome.tabs?.create) {
      chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
      return;
    }

    window.open('chrome://extensions/shortcuts', '_blank');
  };

  const openExternal = (url: string) => {
    if (chrome.tabs?.create) {
      chrome.tabs.create({ url });
      return;
    }

    window.open(url, '_blank', 'noopener');
  };

  const openFeedback = () => openExternal(FEEDBACK_URL);
  const openInlineModeIssue = () => openExternal(INLINE_MODE_DISCUSSION_URL);

  optionsButton?.addEventListener('click', openOptions);
  hotkeysButton?.addEventListener('click', openShortcuts);
  feedbackButton?.addEventListener('click', openFeedback);
  inlineModeButton?.addEventListener('click', openInlineModeIssue);

  return () => {
    chrome.runtime.onMessage.removeListener(messageListener);
    optionsButton?.removeEventListener('click', openOptions);
    hotkeysButton?.removeEventListener('click', openShortcuts);
    feedbackButton?.removeEventListener('click', openFeedback);
    inlineModeButton?.removeEventListener('click', openInlineModeIssue);
  };
}
