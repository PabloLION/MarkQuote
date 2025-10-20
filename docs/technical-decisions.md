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

## Clipboard Fallbacks Removed

**Decision:** MarkQuote only uses `navigator.clipboard.writeText` for copy
operations. We intentionally do **not** maintain a legacy
`document.execCommand('copy')` fallback.

**Reason:** The fallback never succeeds on the protected pages and insecure
origins where the Clipboard API is unavailable—the browser blocks DOM access
entirely, so attempting to write via a hidden `<textarea>` adds complexity
without ever succeeding. Keeping a dead-path fallback obscures the real failure
mode, duplicates logic, and introduces extra maintenance surface in the
background worker for no user benefit.

- **Clarity:** When the Clipboard API is blocked, the pipeline now bubbles that
  failure immediately so review of telemetry stays accurate instead of
  reporting a misleading "fallback triggered".
- **Security parity:** We still surface the popup on blocked/protected pages so
  users can copy manually; removing the DOM fallback does not reduce capability
  because Chrome disallows those writes regardless of implementation.
- **Maintenance:** Eliminating the unused branch keeps `clipboard-injection.ts`
  aligned with Chromium's security model and reduces test permutations that
  cannot pass in practice.
