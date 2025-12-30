# Project Backlog

Temporary holding area for new requests before they are organized into epics.

## Completed / Validated

1. Streamline hotkey permissions so the shortcut works without forcing the popup
   (guide users through granting host/site access). - shipped; keep tests green.

## Pending

- **Split popup toggles for hotkey and context menu** - Add two independent
  toggles: "Show popup after keyboard shortcut" and "Show popup after right-click
  copy". Each toggle controls popup behavior regardless of whether the extension
  is pinned or unpinned. Currently only the right-click toggle exists; hotkey
  always opens popup. Requires refactoring `handleHotkeyCommand()` to copy
  directly (like context menu does) so the popup becomes optional for hotkey too.

- **E2E: Protected page message tests** - Add E2E tests for protected page
  detection (`chrome://`, `file://`). Requires investigation into stubbing
  protected page message flow since Chrome doesn't allow loading `chrome://`
  pages in Playwright. Tests should verify context-specific messages are shown.
  Related: Story 4.2.

## Known Limitations (v1.1.0)

These are documented UX issues to address in v1.2.0 as part of the copy flow refactor:

- **No selection shows stale preview** - When user triggers copy (hotkey/context
  menu) with no text selected, the popup displays the last copied content instead
  of a "no selection" message. **Note:** The clipboard is NOT touched in this
  case (content script returns early, copy pipeline never runs). This is a
  display/UX issue only, not data corruption. Fix requires changes to the copy
  pipeline to track whether a NEW copy happened vs. just displaying queued content.

- **Same-extension options page message** - When on the extension's own options
  page (`chrome-extension://[id]/options.html`), the protected message says
  "Extensions cannot access pages from other extensions" which is technically
  inaccurate since it's the SAME extension. Should say something like "Cannot
  copy from extension settings pages" or detect same-extension pages specifically.

## Notes

- Feature work is tracked in `docs/epics.md` (Epics 4-6).
- When adding new requests, add them here first, then move to appropriate epic
  when planning the next release.
