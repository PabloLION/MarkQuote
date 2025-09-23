# Technical Decisions

This document records the key architectural decisions made during the development of the MarkQuote extension.

## No Framework for Options Page

**Decision:** The options page will be implemented using vanilla TypeScript and HTML, without a UI framework (e.g., React, Svelte, Vue).

**Reason:** The options page has simple requirements that do not necessitate the complexity of a modern UI framework. The primary benefits of frameworks (e.g., complex state management, reactivity, virtual DOM) are overkill for this use case.

- **DOM Manipulation:** The UI is simple enough that direct DOM manipulation with standard browser APIs (e.g., `getElementById`, `addEventListener`) is sufficient and efficient.
- **Reactivity:** The required "reactivity" (e.g., updating a preview when a setting changes) can be easily handled with simple `input` or `blur` event listeners.
- **Performance:** A vanilla implementation avoids the overhead of a framework, resulting in a faster-loading and more lightweight options page.
- **Dependencies:** This approach avoids adding unnecessary dependencies to the project, keeping it lean and easier to maintain.

This decision prioritizes simplicity, performance, and minimal dependencies for an options page with straightforward requirements.
