# Popup Forced State Preview

The popup surface exposes a lightweight dev-only API that makes it easy to preview success and
failure states without running an end-to-end flow.

## Dev query parameters

When the popup is served via `pnpm dev`, append `?state=` to the popup URL to force a state:

- `?state=default` – reset to the default instructional message
- `?state=copied&preview=...` – show the success banner with optional preview text
- `?state=protected` – render the protected-page warning

If no `preview` argument is provided, a built-in sample Markdown block is displayed.

## Runtime API

In dev mode (`import.meta.env.DEV`), the popup registers a global helper:

```ts
window.__MARKQUOTE_POPUP_DEV__?.showSuccess('**Preview** text');
```

Available helpers:

- `showDefault()` – restore the default tip message
- `showSuccess(markdown: string)` – render the copied-state banner with supplied Markdown
- `showProtected()` – show the protected warning state

This API is particularly useful when iterating on styles—open the popup, run a helper from the
console, and adjust CSS without re-triggering copy operations.

The background worker cancels its hotkey fallback timer once it receives the `popup-ready` message
emitted during initialization, so overriding state won’t trigger unintended copy attempts.
