const form = document.getElementById('settings-form') as HTMLFormElement;
const formatTemplate = document.getElementById('format-template') as HTMLTextAreaElement;

// Load the saved format from storage and populate the textarea
chrome.storage.sync.get('format', (data) => {
  if (data.format) {
    formatTemplate.value = data.format;
  }
});

// Save the format to storage when the form is submitted
form.addEventListener('submit', (event) => {
  event.preventDefault();
  const format = formatTemplate.value;
  chrome.storage.sync.set({ format }, () => {
    console.log('Format saved.');
  });
});
