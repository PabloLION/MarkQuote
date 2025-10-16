# Story 3.10 Detection Plan – Ensure Failing Flows Are Detected

## Context

- Manual smoke testing (hotkey fallback with hidden toolbar, context menu copy)
  fails silently while the Playwright suite reports success.
- Existing tests validate the preview and background logging but not the clipboard
  write itself.
- Goal: elevate regression detection so these flows fail the suite when clipboard
  copy is broken.

## Objectives

1. Detect broken hotkey fallback (clipboard not updated when the toolbar icon is
   hidden).
2. Detect broken context-menu copy (clipboard write or logging missing).

## Proposed Tasks

1. **Instrument clipboard writes with tag-aware telemetry**
   - Record clipboard write events alongside the active test tag (e.g.
     `[HOTKEY_FALLBACK]`).
   - Expose a helper in Playwright to wait for matching telemetry and fail if it
     never arrives.

2. **Enhance Playwright flows to assert clipboard telemetry**
   - Update `[HOTKEY_FALLBACK]` spec to expect telemetry success; fail when we
     only see the warning without a write.
   - Update `[CONTEXT_COPY]` spec in the same way.
   - Optionally assert telemetry for `[POPUP_COPY]` so the primary flow stays in
     sync.

3. **Add error log assertions**
   - Ensure failing flows surface a log entry so developers have immediate
     diagnostics.

4. **Documentation updates**
   - Extend the tag legend with telemetry expectations.
   - Document how to grep by tag and inspect the recorded telemetry queue.

## Atomic Commit Breakdown

1. `feat(background): record clipboard telemetry for tagged flows`
   - Add runtime helpers to capture successful clipboard writes with active test
     tags.
2. `test(e2e): fail hotkey and context specs when telemetry is missing`
   - Update Playwright flows to await tagged telemetry and assert clipboard
     payloads.
3. `test(e2e): require error log entries for clipboard fallbacks`
   - Add expectations around background error reporting for degraded paths.
4. `docs(tests): document telemetry-backed coverage and tag usage`
   - Extend coverage guide with tag legend updates and telemetry
     troubleshooting steps.

## Validation

- Run `pnpm run test:e2e` and expect failure until clipboard fixes land.
- Manual smoke test after the fixes: `[HOTKEY_FALLBACK]`, `[CONTEXT_COPY]`,
  `[POPUP_COPY]`.

## Open Questions

- Does the telemetry need to persist across reloads so Playwright can read it
  later?
- Do we need throttling to avoid collisions when the multi-trigger test runs
  several flows quickly?

## Next Steps

- Assign implementation to an upcoming follow-up branch.
- Keep this branch open until the telemetry plumbing is in place.
