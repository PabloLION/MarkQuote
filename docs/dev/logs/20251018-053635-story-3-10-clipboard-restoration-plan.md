# Story 3.10 – Clipboard Restoration Plan

## Context

- **Branch**: `feat/story-3-10-e2e-scenario-matrix`
- **Blockers**: OS clipboard remains stale for `[POPUP_COPY]`, `[CONTEXT_COPY]`,
  `[HOTKEY_FALLBACK]`, `[MULTI_FLOW]`; Playwright reports the same failures; the
  background pipeline no longer reaches the tab-side `copySelectionToClipboard`.

## Objectives

1. Restore a reliable clipboard write path for every trigger via a tab-side
   helper that calls `navigator.clipboard.writeText` under the original user
   activation.
2. Prove the behaviour with unit coverage and Playwright flows (no expected
   failure flags).
3. Document the recovery so future branches know the validated paths.

## Acceptance Criteria

- ✅ Background pipeline hands control to the tab-side copy helper for all
  non-popup flows, with tab ID guard rails.
- ✅ Unit tests cover: background write success, fallback injection success,
  fallback failure logging.
- ✅ Playwright specs `[POPUP_COPY]`, `[CONTEXT_COPY]`, `[HOTKEY_FALLBACK]`,
  `[MULTI_FLOW]` pass and assert the real OS clipboard contents.
- ✅ `docs/dev/test-coverage.md` and the AAA diagram note the restored fallback
  and green flows.
- ✅ `pnpm exec vitest run` and
  `pnpm test:e2e --project=chromium-extension` finish cleanly.

## Atomic Commit Breakdown

- ⏳ Route non-popup flows through the guarded tab injection in
  `copy-pipeline`, keeping detailed logging.
- ⏳ Add unit coverage for background clipboard fallbacks.
- ⏳ Refresh Playwright helpers and specs to assert the OS clipboard, removing
  temporary flags.
- ⏳ Update sanity script usage docs and test coverage references.
- ⏳ Final verification commit capturing command transcripts and notes.

## Technical Approach

1. **Diagnose regression**
   - Use `scripts/sanity/playwright-clipboard-copy.ts` to assert that the page
     level synchronous `execCommand` still succeeds with user activation.
   - Treat the Playwright sanity script as the control: if it succeeds while the
     extension fails, the regression lives in our pipeline rather than a Chrome
     limitation.
   - Trace `runCopyPipeline` → clipboard handoff to confirm where the payload is
     dropped (the background currently stops after formatting).
2. **Reinstate tab copy path**
   - For non-popup flows, immediately invoke
     `chrome.scripting.executeScript(copySelectionToClipboard, …)` with a
     validated tab ID and formatted text so the helper can call
     `navigator.clipboard.writeText` within the same activation.
   - Retire attempts to write from the background; instead, log failures and
     show the manual-copy prompt when the injected helper reports an error.
   - When scripting injection fails, surface the error via `recordError` and
     ensure diagnostics note whether activation may be missing.
3. **Testing**
   - Unit: extend `tests/unit/background/copy-pipeline.test.ts` to simulate
     success and failure permutations with mocked Chrome APIs.
   - E2E: remove `test.fail`, ensure helpers snapshot and restore the OS
     clipboard, and assert payload equality.
   - Scripts: retain the sanity runner for manual validation and document its
     invocation in `tests/e2e/README.md`.
4. **Documentation**
   - Update the tag legend in `docs/dev/test-coverage.md` to reflect green
     clipboard flows.
   - Record the fallback rationale and logging expectations for future work.

## Dependencies & Notes

- Requires Chrome with `clipboardWrite` permission granted; confirm the manifest
  continues to declare it as required.
- Playwright environment must have host clipboard tooling (`pbcopy`, `xclip`,
  or PowerShell equivalents); document prerequisites so missing tools are
  understood.
- Telemetry work is out of scope; focus on behaviour parity first (tab-side copy
  proven in sanity checks).

## Risks & Mitigations

- **Tab ID missing or invalid** → tab injection fails silently.  
  **Mitigation**: add explicit guards, log failure, cover in unit tests.
- **Host clipboard tooling absent** → sanity or Playwright flows throw early.  
  **Mitigation**: document requirements and handle the error with clear
  messaging.
- **Popup closes before selection capture completes** → payload empty.  
  **Mitigation**: verify ordering in `selection.ts` and log empties for
  diagnostics.

## Exit Checklist

- 🔄 Atomic commits merged locally per breakdown.
- ⏳ Manual smoke: all four clipboard flows succeed.
- ⏳ Automated suites green with clipboard assertions visible in traces.
- ⏳ Documentation refreshed and linted.
- ⏳ Summary prepared for the PR comment before push.
