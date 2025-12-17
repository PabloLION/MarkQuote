# Smoke Test Plan: MarkQuote Extension

This document outlines the manual smoke test steps for the MarkQuote Chrome
Extension. Run `pnpm smoke` to print a quick checklist to the terminal.

## Prerequisites

1. The MarkQuote extension code is available locally.
2. All dependencies are installed (`pnpm install`).
3. The extension has been built (`pnpm build`).

## Setup in Chrome

1. Open Chrome and navigate to `chrome://extensions`.
2. Ensure "Developer mode" is enabled (toggle in the top right corner).
3. Click "Load unpacked".
4. Navigate to your project directory and select the `dist` folder.
5. If the extension is already loaded, click the "reload" icon on the MarkQuote
   extension card to ensure the latest changes are applied.

## Test Coverage Legend

- **[E2E]** - Covered by Playwright E2E tests (`pnpm test:e2e`)
- **[Manual]** - Requires manual testing (Playwright limitations)

## Manual-Only Tests

These scenarios cannot be automated due to Chrome/Playwright limitations:

### 1. Toolbar Icon Click (Pinned) [Manual]

- **Why manual:** Chrome blocks `chrome.action.openPopup()` automation
- **Steps:**
  1. Pin the MarkQuote icon to the toolbar (click puzzle icon → pin).
  2. Navigate to any webpage with selectable text.
  3. Select a block of text on the page.
  4. Click the MarkQuote extension icon in the toolbar.
- **Expected:** Popup opens showing formatted markdown preview.

### 2. Keyboard Shortcut with Pinned Icon [Manual]

- **Why manual:** Same limitation as above
- **Steps:**
  1. Ensure the icon is pinned to the toolbar.
  2. Select text on any webpage.
  3. Press `Alt+C` (Windows/Linux) or `Option+C` (Mac).
- **Expected:** Popup opens showing formatted markdown preview.

### 3. Protected chrome:// Page [Manual]

- **Why manual:** Chrome blocks extension access to chrome:// in E2E
- **Steps:**
  1. Navigate to `chrome://settings` or `chrome://extensions`.
  2. Try to copy using context menu or keyboard shortcut.
  3. Click the extension icon.
- **Expected:** Popup shows "Chrome internal pages are protected" message.

### 4. Protected file:// Page [Manual]

- **Why manual:** Same limitation as chrome:// pages
- **Steps:**
  1. Open a local HTML file via `file://` URL.
  2. Try to copy using context menu or keyboard shortcut.
  3. Click the extension icon.
- **Expected:** Popup shows "Local file pages require explicit permission"
  message.

## Feature Verification Tests

### 5. Context Menu Copy [E2E]

- **Steps:**
  1. Navigate to any webpage with selectable text.
  2. Select a block of text.
  3. Right-click and select "Copy as Markdown Quote".
  4. Paste into a text editor.
- **Expected:** Markdown blockquote with source link.

### 6. Keyboard Shortcut (Unpinned) [E2E]

- **Steps:**
  1. Unpin the extension icon from the toolbar.
  2. Select text on any webpage.
  3. Press `Alt+C` (Windows/Linux) or `Option+C` (Mac).
  4. Paste into a text editor.
- **Expected:** Markdown blockquote copied to clipboard.

### 7. Options Page Rule Editing [E2E]

- **Steps:**
  1. Open the options page (right-click icon → Options).
  2. Add or modify a title rule.
  3. Save changes.
  4. Reload the options page.
- **Expected:** Changes persist across page reload.

### 8. Error Badge and List (Epic 4) [E2E]

- **Steps:**
  1. Trigger an error (e.g., try copying on a protected page).
  2. Observe the extension icon for a badge number.
  3. Open the popup.
- **Expected:** Badge shows error count; popup displays error list.

### 9. Error Copy Details (Epic 4) [E2E]

- **Steps:**
  1. With errors showing in popup, click "Copy details" button.
  2. Paste into a text editor.
- **Expected:** Markdown-formatted error report with environment info.

### 10. Error Dismiss (Epic 4) [E2E]

- **Steps:**
  1. With errors showing in popup, click "Dismiss" button.
- **Expected:** Errors cleared; badge removed from icon.

### 11. Preview Truncation (Epic 4) [E2E]

- **Steps:**
  1. Select a long text (500+ characters) on any webpage.
  2. Copy via popup and observe the preview.
  3. Click "Show more" toggle.
- **Expected:** Preview truncated initially; expands on toggle click.

### 12. Always-On Confirmation Toggle (Epic 4) [Manual]

- **Why manual:** Requires `chrome.action.openPopup()` which can't be automated
- **Steps:**
  1. Open options page.
  2. Enable "Show confirmation popup after copying" checkbox.
  3. Save changes.
  4. Use keyboard shortcut or context menu to copy text.
- **Expected:** Popup automatically opens showing the copied content.

### 13. Icon Appearance [Manual]

- **Steps:**
  1. Observe the MarkQuote icon in the Chrome toolbar.
  2. Navigate to `chrome://extensions` and locate the extension card.
- **Expected:** Icon renders clearly at all sizes (16x16, 48x48, 128x128).
