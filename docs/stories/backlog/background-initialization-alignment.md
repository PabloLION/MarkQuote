# Backlog – Background Naming & Initialization Alignment

## Overview

Story 3.12 brings the background service naming and initialization flows in line
with their current responsibilities. The legacy names
(`ensureOptionsInitialized`, `triggerCopy`) no longer reflect what the functions
actually do, and ad-hoc resets leave caches (preview text, diagnostics)
populated after integration tests. This confusion contributed to recent
regressions and makes onboarding harder.

## Objectives

- Rename `ensureOptionsInitialized` to something that captures both
  initialization and migration (e.g., `initializeOrUpdateOptions`) and update
  documentation accordingly.
- Rename `triggerCopy` to a handler-oriented name (e.g., `copyEventHandler`) and
  break orchestration pieces into smaller helpers.
- Centralize reset behavior so preview caches, diagnostics, and forced overrides
  are cleared consistently.
- Ensure each rename includes exhaustive TypeScript refactors, logging updates,
  and test adjustments.

## Deliverables

- Updated background modules with the new function names and extracted helpers.
- Revised tests (unit + E2E) referencing the renamed functions.
- Documentation updates (`docs/dev/options-migrations.md`,
  `docs/dev/test-coverage.md`, etc.) that explain the revised flows.
- Changelog entry noting the refactor for future contributors.

## Acceptance Criteria

- Background build passes with the new names and there are no lingering
  references to the deprecated identifiers.
- Reset flows clear preview caches, diagnostics, and forced overrides, verified
  by tests.
- Documentation and inline comments describe the responsibilities of the
  refactored helpers.

## Risks & Mitigations

- **Refactor scope creep**: constrain the work to naming/structure changes
  without altering behavior; add regression tests before extracting helpers.
- **Extension lifecycle quirks**: manually verify context menu and hotkey flows
  still initialize options after the rename.
- **Doc drift**: double-check references in onboarding docs and diagrams after
  renaming.

## References

- Backlog: Epic 3 (quality) and Epic 4 (core stability) items requesting alignment.
