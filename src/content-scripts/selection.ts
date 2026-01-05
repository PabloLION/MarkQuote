import { convertHtmlToMarkdown } from "../converter.js";

(() => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    // Notify background that there was no selection so it can clear stale preview
    chrome.runtime.sendMessage({ noSelection: true });
    return;
  }

  const range = selection.getRangeAt(0);
  const container = document.createElement("div");
  container.appendChild(range.cloneContents());

  // Remove script, style, noscript, and template tags that may be captured in selection
  for (const tag of ["script", "style", "noscript", "template"]) {
    for (const element of Array.from(container.querySelectorAll(tag))) {
      element.remove();
    }
  }

  const html = container.innerHTML;
  const markdown = convertHtmlToMarkdown(html);

  // Also notify if the selection was empty after processing
  if (!markdown.trim()) {
    chrome.runtime.sendMessage({ noSelection: true });
    return;
  }

  chrome.runtime.sendMessage({ markdown });
})();
