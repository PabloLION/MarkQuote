# Smoke Test Plan: MarkQuote Extension (fix/story-2.6-smoke-test-basic branch)

This document outlines the manual smoke test steps for the MarkQuote Chrome Extension, covering the core functionalities implemented up to the `fix/story-2.6-smoke-test-basic` branch. These steps can serve as a basis for developing automated End-to-End (E2E) tests using Playwright.

## Prerequisites

1. The MarkQuote extension code is available locally.
2. All dependencies are installed (`pnpm install`).
3. The extension has been built (`pnpm build`).

## Setup in Chrome

1. Open Chrome and navigate to `chrome://extensions`.
2. Ensure "Developer mode" is enabled (toggle in the top right corner).
3. Click "Load unpacked".
4. Navigate to your project directory and select the `dist` folder.
5. If the extension is already loaded, click the "reload" (circular arrow) icon on the MarkQuote extension card to ensure the latest changes are applied.

## Test Cases

### 1. Verify Core Copy Functionality (Context Menu)

- **Objective:** Ensure text selection and copying via the context menu works correctly.
- **Steps:**
  1. Navigate to any webpage with selectable text (e.g., `https://example.com`).
  2. Select a block of text on the page.
  3. Right-click the selected text.
  4. From the context menu, click "Copy as Markdown Quote".
  5. Open a text editor (e.g., Notepad, VS Code, or a new browser tab with a text area).
  6. Paste the content (`Ctrl+V` or `Cmd+V`).
- **Expected Result:** The pasted content should be the selected text formatted as a Markdown blockquote (prefixed with `>` on each line) followed by a source link in the format `> Source: [Page Title](Page URL)`.

### 2. Verify Toolbar Icon Behavior

- **Objective:** Ensure clicking the toolbar icon copies selected text silently, and right-clicking provides access to options.
- **Steps (Clicking):**
  1. Navigate to any webpage with selectable text.
  2. Select a block of text on the page.
  3. Click the MarkQuote extension icon in the Chrome toolbar (usually next to the address bar).
  4. Open a text editor.
  5. Paste the content.
- **Expected Result (Clicking):** The pasted content should be the selected text formatted as a Markdown blockquote with a source link. No popup should appear.
- **Steps (Right-clicking for Options):**
  1. Right-click the MarkQuote extension icon in the Chrome toolbar.
  2. From the context menu, click "Options".
- **Expected Result (Right-clicking for Options):** A new Chrome tab should open, displaying the MarkQuote extension's options page (`chrome-extension://<extension-id>/options.html`).

### 3. Verify Keyboard Shortcut

- **Objective:** Ensure the configured keyboard shortcut copies selected text silently.
- **Steps:**
  1. Navigate to any webpage with selectable text.
  2. Select a block of text on the page.
  3. Press the configured keyboard shortcut:
     - **Windows/Linux:** `Alt+C`
     - **Mac:** `Option+C`
  4. Open a text editor.
  5. Paste the content.
- **Expected Result:** The pasted content should be the selected text formatted as a Markdown blockquote with a source link. No popup should appear.

### 4. Verify Icon Appearance

- **Objective:** Confirm the extension's icon is displayed correctly in the toolbar and extension management page.
- **Steps:**
  1. Observe the MarkQuote extension icon in the Chrome toolbar.
  2. Navigate to `chrome://extensions` and locate the MarkQuote extension card.
- **Expected Result:** The icon should be the new solid MarkQuote logo (the one based on `icon-mark-solid.svg`), rendered clearly and correctly at all sizes (e.g., 16x16 in toolbar, 48x48 on extensions page).

### 5. Verify Options Page (Basic UI)

- **Objective:** Ensure the basic options page UI loads correctly.
- **Steps:**
  1. Open the options page (via right-click on toolbar icon -> Options, as described in Test Case 2).
- **Expected Result:** The page should display the title "MarkQuote Options" and contain a text area labeled "Source Link Format".
