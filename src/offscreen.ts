chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'copy-to-clipboard') {
    const input = document.createElement('textarea');
    document.body.appendChild(input);
    input.value = msg.text;
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
  }
});
