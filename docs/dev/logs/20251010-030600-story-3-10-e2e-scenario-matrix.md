<!-- markdownlint-disable MD013 MD036 -->

# Plan – Story 3.10 E2E Scenario Matrix Hardening

## Context

Story 3.10 expands Playwright coverage so we exercise multiple copy triggers in
sequence and verify clipboard results stay fresh across steps. The current suite
only covers isolated flows, so chained scenarios and repeat runs remain
untested.

## Tasks

1. **Helper groundwork**
   - Add a clipboard nonce helper (mint + assert) under `tests/e2e/helpers/`.
   - Extend the background bridge with utilities to reset/read diagnostics for
     multi-step assertions.
   - Provide a shared OS clipboard restore helper so specs clean up after each
     run.
2. **Multi-trigger flow coverage**
   - Create a new spec (e.g., `multi-trigger-flows.spec.ts`) that keeps a single
     extension context alive and executes:
     - Toolbar popup → hotkey fallback chain.
     - Hotkey → context menu → popup chain.
     - Context menu twice across different tabs.
     - Success → failure sequences (protected URL / empty selection).
   - Use nonce helpers to assert clipboard, preview, and diagnostics after each
     step.
   - Tag one representative scenario with `[smoke]` for the quick subset run.
3. **Refine existing specs**
   - Reuse the new helpers in `popup-copy-flow`, `hotkey-flow`, and others to
     remove duplicated nonce logic.
   - Ensure only one `[smoke]` tag remains across the suite.
4. **Documentation**
   - Update `tests/e2e/README.md` (and `docs/dev/test-coverage.md` if needed)
     with instructions for the multi-step flows and clipboard tooling.
5. **Validation**
   - Run `pnpm test:e2e` and `pnpm test:e2e -- --grep "[smoke]"`.
   - Confirm `pnpm test` (unit + e2e) passes locally.

## Atomic Commit Breakdown

1. Introduce helper groundwork (nonce utilities, diagnostics reset, clipboard
   restore) alongside focused unit coverage.
2. Add the multi-trigger Playwright spec that exercises chained flows and tags
   the smoke scenario.
3. Refine existing specs to consume shared helpers and adjust smoke tagging.
4. Update documentation (`tests/e2e/README.md`, `docs/dev/test-coverage.md`) to
   describe the new flows and helper usage.
5. Run the validation commands (`pnpm test:e2e`, smoke subset, `pnpm test`) and
   record outcomes in this log.

## Validation Results

- 2025-10-10 `pnpm test:e2e` — ✅ pass (10.4s, 10 specs)
- 2025-10-10 `pnpm exec playwright test --grep "\\[smoke\\]"` — ✅ pass
  (multi-trigger matrix only)
- 2025-10-10 `pnpm test` — ✅ pass (unit + full Playwright suite)

## Risks & Mitigations

- Clipboard timing – rely on diagnostics polling instead of arbitrary sleeps.
- Runtime growth – keep default run manageable by tagging only one scenario as
  `[smoke]`.
- Flake introduction – rerun smoke suite several times before finalizing.
