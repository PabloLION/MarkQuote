# MarkQuote Chrome Extension

MarkQuote is a Chrome extension designed to streamline the process of referencing web content in markdown-based notes. It allows users to copy selected rich text from a webpage and instantly convert it into a markdown blockquote that includes a formatted source link.

- Debug info are available in the console of the "Inspect views" of the extension in `chrome://extensions`.
- Not minified for its small size and better readability.

## Usage

MarkQuote provides several ways to copy selected web content as a Markdown quote:

- **Context Menu:** Select text on a webpage, right-click, and choose "Copy as Markdown Quote".
- **Toolbar Icon:** Click the MarkQuote icon in the Chrome toolbar. This will directly copy the currently selected text.
- **Keyboard Shortcut:** Use the configured keyboard shortcut (default: `Alt+C` on Windows/Linux, `Option+C` on Mac) to copy the selected text. Note that this shortcut will _not_ open the extension's popup; it performs the copy silently.
- **Options Page:** Right-click the MarkQuote icon in the Chrome toolbar and select "Options" to access the extension's settings.

## Architecture Overview

This extension follows the Manifest V3 architecture for Chrome Extensions, pairing a background Service Worker with lightweight extension pages (popup/options) to handle user interaction and clipboard access.

### `src/background.ts` (Service Worker)

The `background.ts` script serves as the extension's **Service Worker**. It operates in the background, listening for various browser events and coordinating the extension's functionality.

- **Event-Driven:** It's designed to be event-driven, meaning it wakes up when an event occurs (e.g., a user clicks the extension icon, a context menu item is selected) and goes dormant when idle to conserve system resources.
- **No Direct DOM Access:** Crucially, the Service Worker does **not** have direct access to the DOM (Document Object Model) of web pages or the extension's own HTML pages. This is a security and performance feature of Manifest V3.
- **Central Coordinator:** It acts as the hub, managing context menus, toolbar clicks, and messages from scripts like `selection.ts`, then distributing formatted results to the popup.

### `src/popup.ts` (Extension UI)

The popup receives the formatted markdown from the background worker, renders it for preview, and writes it to the clipboard using the modern Clipboard API. Because the popup runs in a focused extension page, it can interact with the DOM and clipboard without relying on hidden offscreen documents.

## Development Setup

To set up and run the MarkQuote extension locally:

1. Clone the repository:

   ```bash
   git clone [repository_url]
   cd MarkQuote
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Build the extension:

   ```bash
   pnpm build
   ```

4. Load in Chrome:
   - Open Chrome and navigate to `chrome://extensions`.
   - Enable "Developer mode" in the top right corner.
   - Click "Load unpacked".
   - Select the `dist` folder in your project directory.

## Special thanks

- Icon inspired by [dcurtis/markdown-mark](https://github.com/dcurtis/markdown-mark) and created with **Gill Sans Bold** and [Google Font to Svg Path](https://danmarshall.github.io/google-font-to-svg-path/)
