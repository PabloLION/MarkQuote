# Project Backlog

Concise list of outstanding fixes and refactors, grouped by focus area.

## Completed / Validated

1. Streamline hotkey permissions so the shortcut works without forcing the popup
   (guide users through granting host/site access). — shipped; keep tests green.

## Accessibility

1. Provide keyboard-based reordering for rules tables in the options UI
   (accessible alternative to drag-and-drop).

## Diagnostics & Feedback

1. Enrich error diagnostics and expose a “Copy error details” action in the popup.
2. Add Playwright coverage for the error-log lifecycle (seed, badge, popup clear).
3. Add a settings toggle that always surfaces the copy confirmation popup after
   each capture, expose the control within the popup surface, and default it to
   “on” to guarantee feedback on first run.

## Runtime Quality

1. Centralize shared runtime constants (clipboard caps, loader timeouts, status
   labels) to eliminate duplication.
2. Align background initialization helpers with their responsibilities
   (rename `ensureOptionsInitialized`, restructure `triggerCopy` handler).

## Testing & Documentation

1. Expand Playwright coverage to include chained copy scenarios and repeated
   triggers (multi-step end-to-end flows).
2. Document the E2E smoke subset (`--grep "[smoke]"`) and the
   `VITE_E2E=true pnpm build` prerequisite.
3. Replace eval-based test timers (`lolex`/`nise`) with safer alternatives.
