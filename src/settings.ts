const form = document.getElementById('settings-form') as HTMLFormElement;
const formatTemplate = document.getElementById('format-template') as HTMLTextAreaElement;
const preview = document.querySelector('code') as HTMLElement;

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

// Update preview on input
formatTemplate.addEventListener('input', updatePreview);

// Save the format to storage when the form is submitted
form.addEventListener('submit', (event) => {
  event.preventDefault();
  const format = formatTemplate.value;
  chrome.storage.sync.set({ format }, () => {
    console.log('Format saved.');
  });
});
