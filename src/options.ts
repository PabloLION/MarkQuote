document.addEventListener('DOMContentLoaded', () => {
  const formatTemplate = document.getElementById('format-template') as HTMLTextAreaElement;
  const preview = document.getElementById('preview') as HTMLElement;

  const example = {
    title: 'Example Page Title',
    url: 'https://example.com/article',
  };

  function updatePreview() {
    const format = formatTemplate.value;
    const output = format.replace('{{title}}', example.title).replace('{{url}}', example.url);
    preview.textContent = `> Some copied text...\n${output}`;
  }

  // Load the saved format from storage and populate the textarea
  chrome.storage.sync.get('format', (data) => {
    if (data.format) {
      formatTemplate.value = data.format;
    }
    updatePreview();
  });

  // Update preview and save on input
  formatTemplate.addEventListener('input', () => {
    updatePreview();
    const format = formatTemplate.value;
    chrome.storage.sync.set({ format });
  });
});
