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

## Notes

- Feature work is tracked in `docs/epics.md` (Epics 4-6).
- When adding new requests, add them here first, then move to appropriate epic
  when planning the next release.
