import { convertHtmlToMarkdown } from "../converter.js";

(() => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return;
  }

  const range = selection.getRangeAt(0);
  const container = document.createElement("div");
  container.appendChild(range.cloneContents());
  const html = container.innerHTML;
  const markdown = convertHtmlToMarkdown(html);
  chrome.runtime.sendMessage({ markdown });
})();
