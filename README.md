# MarkQuote Chrome Extension

MarkQuote is a Chrome extension designed to streamline the process of referencing web content in markdown-based notes. It allows users to copy selected rich text from a webpage and instantly convert it into a markdown blockquote that includes a formatted source link.

- Debug info are available in the console of the "Inspect views" of the extension in `chrome://extensions`.
- Not minified for its small size and better readability.

## Architecture Overview

This extension is built following the Manifest V3 architecture for Chrome Extensions, which emphasizes the use of Service Workers for background tasks and Offscreen Documents for DOM-related operations.

### `src/background.ts` (Service Worker)

The `background.ts` script serves as the extension's **Service Worker**. It operates in the background, listening for various browser events and coordinating the extension's functionality.

- **Event-Driven:** It's designed to be event-driven, meaning it wakes up when an event occurs (e.g., a user clicks the extension icon, a context menu item is selected) and goes dormant when idle to conserve system resources.
- **No Direct DOM Access:** Crucially, the Service Worker does **not** have direct access to the DOM (Document Object Model) of web pages or the extension's own HTML pages. This is a security and performance feature of Manifest V3.
- **Central Coordinator:** It acts as the central hub, managing context menus, handling toolbar icon clicks, receiving messages from content scripts (like `selection.ts`), and orchestrating complex operations by communicating with other parts of the extension, such as the Offscreen Document.

### `src/offscreen.ts` (Offscreen Document)

The `offscreen.ts` script runs within a hidden HTML page (`offscreen.html`) known as an **Offscreen Document**. This component is specifically used to perform tasks that require DOM access or certain browser APIs that are unavailable to the Service Worker.

- **DOM Access:** Unlike the Service Worker, the Offscreen Document **does** have access to the DOM. This makes it suitable for operations that involve manipulating HTML elements or using APIs that depend on a document context.
- **Clipboard Operations:** Its primary role in MarkQuote is to handle clipboard operations. Due to browser security restrictions, directly copying text to the user's clipboard from a Service Worker is not straightforward. The Offscreen Document provides a secure and reliable environment to execute clipboard commands (like `document.execCommand('copy')`) by temporarily creating and manipulating a hidden `<textarea>` element.
- **Managed by Service Worker:** The Offscreen Document is created and managed by the `background.ts` Service Worker, which sends it messages with data to be processed (e.g., text to copy).

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

- Icon inspired by [dcurtis/markdown-mark](https://github.com/dcurtis/markdown-mark)
