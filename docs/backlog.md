# Project Backlog

Concise list of outstanding fixes and refactors, grouped by focus area.

## Completed / Validated

1. Streamline hotkey permissions so the shortcut works without forcing the popup
   (guide users through granting host/site access). — shipped; keep tests green.

## Accessibility

- Tracked under `docs/prd.md` Epic 6: Power User & Accessibility Enhancements.

## Diagnostics & Feedback

- Tracked under `docs/prd.md` Epic 4: Copy Feedback & Diagnostics.

## Hub & History

- Tracked under `docs/prd.md` Epic 5: MarkQuote Hub & History.

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
