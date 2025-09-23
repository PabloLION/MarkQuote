chrome.runtime.onMessage.addListener((msg) => {
  console.log('Offscreen document received message:', msg);
  if (msg.type === 'copy-to-clipboard') {
    console.log('Attempting to copy text to clipboard:', msg.text);
    const textarea = document.getElementById('clipboard-textarea') as HTMLTextAreaElement;
    textarea.value = msg.text;
    textarea.select();
    try {
      document.execCommand('copy');
      console.log("Text successfully copied to clipboard using document.execCommand('copy').");
    } catch (err) {
      console.error("Failed to copy text using document.execCommand('copy'):", err);
    }
  }
});
