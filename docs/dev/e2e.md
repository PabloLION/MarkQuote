# End-to-End Testing

The Playwright suite spins up the packaged extension, launches Chromium with a temporary profile, and drives both the popup and options UI. Tests live in `tests/e2e/` and are run in CI via `pnpm test:e2e`.

## Commands

- `pnpm test:e2e` – build the extension and execute every Playwright spec.
- `pnpm test:e2e -- --project=chromium-extension --grep "selection"` – rerun a focused subset locally.
- `pnpm exec playwright show-trace <path>` – open an interactive trace from a failed run.

## Fixtures & Helpers

- `tests/e2e/helpers/extension.ts` handles launching the MV3 extension context and opening extension pages.
- `tests/e2e/helpers/e2e.ts` sends test-only runtime messages (selection payloads, option seeding, formatted snapshot reads).
- Global setup rebuilds the extension with `VITE_E2E=true`, expanding host permissions required by the stubs.

## Theme Coverage

The popup selection flow runs twice (dark and light color schemes) to guard styling differences. `launchExtensionContext` accepts a `colorScheme` option so individual specs can opt-in to additional themes.

## Storage & Rule Testing

- Options persistence is exercised through the real UI (`options-rules.spec.ts` edits fields, saves, and asserts the popup preview).
- Rule-chaining behaviour is validated by seeding deterministic rule sets through the `e2e:set-options` message before driving the popup.

## Debug Tips

- Keep a `pnpm dev:playwright` terminal handy for manual inspection while iterating on specs.
- When a test fails, inspect `test-results/**/trace.zip` with `pnpm exec playwright show-trace` for screenshots, console output, and network logs.
- The background worker logs to DevTools; open `chrome://extensions` → “service worker” link if you need to attach during a debug session.
