type CopiedTextMessage = {
  type: 'copied-text-preview';
  text: string;
};

export function initializePopup(): () => void {
  const messageDiv = document.getElementById('message');
  const previewDiv = document.getElementById('preview');
  const settingsButton = document.getElementById('settings-button');
  const sourceLinkFormatterButton = document.getElementById('source-link-formatter-button');
  const hotkeysButton = document.getElementById('hotkeys-button');

  if (!chrome?.runtime) {
    console.warn('chrome.runtime is unavailable; popup interactions are limited.');
    return () => {};
  }

  const messageListener = (request: CopiedTextMessage) => {
    if (request.type === 'copied-text-preview') {
      if (messageDiv) messageDiv.textContent = 'Copied!';
      if (previewDiv) previewDiv.textContent = request.text;
    }
  };

  chrome.runtime.onMessage.addListener(messageListener);

  const openOptions = () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    }
  };

  const openShortcuts = () => {
    if (chrome.tabs?.create) {
      chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
    }
  };

  settingsButton?.addEventListener('click', openOptions);
  sourceLinkFormatterButton?.addEventListener('click', openOptions);
  hotkeysButton?.addEventListener('click', openShortcuts);

  return () => {
    chrome.runtime.onMessage.removeListener(messageListener);
    settingsButton?.removeEventListener('click', openOptions);
    sourceLinkFormatterButton?.removeEventListener('click', openOptions);
    hotkeysButton?.removeEventListener('click', openShortcuts);
  };
}
