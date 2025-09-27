# Chrome Web Store Privacy Disclosures

Use these answers to complete the **Privacy** tab in the Chrome Web Store dashboard. MarkQuote does
not collect, transmit, or sell user data. All processing happens locally inside the browser.

## Single Purpose

MarkQuote converts highlighted text from the current tab into Markdown and copies it to the clipboard
so researchers can save quotes quickly. Every permission exists only to support this workflow.

## Permission Justifications

- **`contextMenus`:** adds the “Copy as Markdown quote” item to the right-click menu so users can
  trigger MarkQuote without opening the toolbar popup.
- **`activeTab`:** grants temporary access to the user’s current tab so we can read the highlighted
  selection when the user asks to copy it.
- **`scripting`:** injects a small content script on-demand to pull the selected text and page metadata
  that is turned into Markdown.
- **`storage`:** persists the user’s formatting preferences (template, title/URL rules) locally so their
  configuration is restored the next time they use MarkQuote.

## Remote Code

- **Status:** No, MarkQuote does not use remote code.
- **Justification:** All JavaScript and assets ship inside the extension package. There are no external
  `<script>` tags, remote modules, or dynamic `eval` calls.

## Data Usage

MarkQuote does not collect any user data categories listed in the Chrome Web Store form:

- Personally identifiable information
- Health information
- Financial or payment information
- Authentication information
- Personal communications
- Location data
- Web history
- User activity telemetry
- Website content beyond the in-page selection the user explicitly copies (processed locally only)

## Developer Certifications

By publishing a new version we certify that:

1. We do not sell or transfer user data to third parties outside of the approved use cases.
2. We do not use or transfer user data for purposes unrelated to MarkQuote’s single purpose.
3. We do not use or transfer user data to determine creditworthiness or for lending purposes.

## Privacy Policy

Public policy URL referenced in the listing:

- <https://pablolion.github.io/markquote/privacy>
