# Project Backlog

Concise list of outstanding fixes and refactors.

## Stories

- [ ] Story 3.10 — E2E Scenario Matrix Hardening  
  `docs/stories/3.10-e2e-scenario-matrix.md`
- [ ] Story 3.11 — Error Diagnostics & Reporting  
  `docs/stories/3.11-error-diagnostics-overhaul.md`
- [ ] Story 3.12 — Background Initialization Alignment  
  `docs/stories/3.12-background-initialization-alignment.md`
- [ ] Streamline Hotkey Permissions — guide users through granting host access
  so hotkey copies can run without forcing the popup. (Story doc pending.)
- [ ] Keyboard Reordering for Rules Tables — provide an accessible alternative
  to drag-and-drop in the options UI. (Story doc pending.)
- [ ] Centralize Shared Runtime Constants — consolidate duplicated clipboard
  caps, loader timeouts, and status labels. (Story doc pending.)
- [ ] Complete E2E Suite Rollout — original Story 3.3 follow-ups for popup copy,
  options rule application, and popup UI coverage. (Story doc: `docs/stories/3.3-expand-e2e-coverage.md`.)

## Tasks

- [ ] Add documentation for the E2E smoke subset (`--grep "[smoke]"`) and the
  `VITE_E2E=true pnpm build` prerequisite.
- [ ] Replace eval-based test timers (`lolex`/`nise`) with safer alternatives.
- [ ] Capture error-log lifecycle Playwright coverage (seed errors, verify badge
  and popup list, clear via UI).
- [ ] Add “Copy error details” control to the popup error panel.
