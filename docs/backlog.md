# Project Backlog

Concise list of outstanding fixes and refactors.

## Backlog Items

- Streamline hotkey permissions so the shortcut works without forcing the popup
  (guide users through granting host/site access).
- Provide keyboard-based reordering for rules tables in the options UI (accessible
  alternative to drag-and-drop).
- Centralize shared runtime constants (clipboard caps, loader timeouts, status
  labels) to eliminate duplication.
- Expand Playwright coverage to include chained copy scenarios and repeated
  triggers (multi-step end-to-end flows).
- Enrich error diagnostics and expose a “Copy error details” action in the popup.
- Align background initialization helpers with their responsibilities
  (rename `ensureOptionsInitialized`, restructure `triggerCopy` handler).
- Document the E2E smoke subset (`--grep "[smoke]"`) and the
  `VITE_E2E=true pnpm build` prerequisite.
- Replace eval-based test timers (`lolex`/`nise`) with safer alternatives.
- Add Playwright coverage for the error-log lifecycle (seed, badge, popup clear).
