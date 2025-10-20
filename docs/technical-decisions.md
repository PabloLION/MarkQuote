# Technical Decisions

This document records the key architectural decisions made during the
development of the MarkQuote extension.

## No Framework for Options Page

**Decision:** The options page will be implemented using vanilla TypeScript and
HTML, without a UI framework (e.g., React, Svelte, Vue).

**Reason:** The options page has simple requirements that do not necessitate the
complexity of a modern UI framework. The primary benefits of frameworks (e.g.,
complex state management, reactivity, virtual DOM) are overkill for this use
case.

- **DOM Manipulation:** The UI is simple enough that direct DOM manipulation
  with standard browser APIs (e.g., `getElementById`, `addEventListener`) is
  sufficient and efficient.
- **Reactivity:** The required "reactivity" (e.g., updating a preview when a
  setting changes) can be easily handled with simple `input` or `blur` event
  listeners.
- **Performance:** A vanilla implementation avoids the overhead of a framework,
  resulting in a faster-loading and more lightweight options page.
- **Dependencies:** This approach avoids adding unnecessary dependencies to the
  project, keeping it lean and easier to maintain.

This decision prioritizes simplicity, performance, and minimal dependencies for
an options page with straightforward requirements.

## Clipboard Fallback Policy

**Decision:** Clipboard writes first attempt `navigator.clipboard.writeText` via
the tab context. We deliberately avoid the legacy `document.execCommand('copy')`
path, but retain a service-worker clipboard fallback for hotkey flows where the
tab context lacks a fresh user gesture.

**Reason:** The DOM-based fallback (hidden `<textarea>` +
`document.execCommand('copy')`) still fails on protected origins and insecure
tabs, yet adds maintenance overhead and muddles telemetry. However, when users
trigger the keyboard shortcut with the action unpinned, Chrome can reject the
tab-side API while the background worker still has `clipboardWrite` permission.
Keeping the background fallback preserves the hotkey workflow without
reintroducing the brittle DOM hack.

- **Clarity:** Tab writes report accurate failures, and the background fallback
  runs only when the tab copy genuinely fails.
- **Security parity:** Protected URLs still surface the popup so users can copy
  manually—no DOM injection occurs on restricted pages.
- **Maintenance:** The clipboard helper remains aligned with Chromium’s security
  model while the background worker fallback covers the one workflow Chrome
  still permits programmatically.
