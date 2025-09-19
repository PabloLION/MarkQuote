document.addEventListener('DOMContentLoaded', () => {
  const messageDiv = document.getElementById('message');
  const previewDiv = document.getElementById('preview');
  const settingsButton = document.getElementById('settings-button');
  const sourceLinkFormatterButton = document.getElementById('source-link-formatter-button');
  const hotkeysButton = document.getElementById('hotkeys-button');

  // Placeholder for receiving copied text
  chrome.runtime.onMessage.addListener((request) => {
    if (request.type === 'copied-text-preview') {
      if (messageDiv) messageDiv.textContent = 'Copied!';
      if (previewDiv) previewDiv.textContent = request.text;
    }
  });

  settingsButton?.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  sourceLinkFormatterButton?.addEventListener('click', () => {
    // This will open the settings page, we'll need to navigate to a specific section later
    chrome.runtime.openOptionsPage();
  });

  hotkeysButton?.addEventListener('click', () => {
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  });
});
