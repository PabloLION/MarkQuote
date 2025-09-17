const selection = window.getSelection();
if (selection && selection.rangeCount > 0) {
  const range = selection.getRangeAt(0);
  const container = document.createElement('div');
  container.appendChild(range.cloneContents());
  const html = container.innerHTML;
  chrome.runtime.sendMessage({ html });
}
