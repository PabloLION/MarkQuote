<!-- markdownlint-disable MD013 -->

# Playwright Suite Overview

This directory hosts the end-to-end coverage for MarkQuote. Playwright drives a real Chromium profile with the packaged extension so we can exercise the popup, background worker, and options UI together.

## Preparation Flow

1. **Global setup** (`tests/e2e/global-setup.ts`)
   - Runs `pnpm build` with `VITE_E2E=true` to produce a fresh `dist/` bundle before Playwright launches.
2. **Extension launch** (`helpers/extension.ts`)
   - Creates a temporary user data directory and starts Chromium with `--disable-extensions-except` / `--load-extension` pointing at `dist/`.
   - Reads the runtime extension ID via `chrome://extensions` so specs can open `options.html` and `popup.html` directly.
3. **Test messaging helpers** (`helpers/e2e.ts`)
   - Provide utilities for sending synthetic selection messages, seeding options payloads, and reading the latest formatted preview through the background worker’s e2e hooks.

## Covered Scenarios

- **Multi-trigger matrix (smoke):** exercises popup → hotkey fallback → context menu chains within a single browser session, verifying preview strings, hotkey diagnostics, and clipboard resets as flows succeed or hit protected pages (`tests/e2e/multi-trigger-flows.spec.ts`).
- **Popup pipeline:** stubs a Wikipedia article, selects text, fires the background copy request, and asserts the popup preview. Runs in both light and dark color schemes.
- **Hotkey fallback:** simulates the keyboard shortcut when the toolbar icon is hidden, confirming the background logs the warning and still formats the captured selection.
- **Context menu bridge:** triggers the background copy handler directly from an options bridge page, ensuring preview + error log behaviour stays healthy.
- **Options editing via UI:** fills in rule fields, saves through the real form, and verifies the popup preview reflects the updated template and replacement rules in the same session.
- **Rule break / continue behaviour:** seeds deterministic URL rules (UTM stripping + Amazon canonicalisation), triggers the popup twice, and confirms the formatted output respects breakpoints versus continued matching.
- **Onboarding defaults & feedback CTA:** validates the first-run template plus the Feedback button routing.

## Running the Suite

- `pnpm test:e2e` – rebuilds the extension and runs every spec.
- `pnpm test:e2e -- --grep "\[smoke\]"` – run the multi-trigger matrix only.
- `pnpm test:e2e -- --grep "selection"` – focus a subset by name.
- `pnpm exec playwright show-trace test-results/<spec>/trace.zip` – inspect failures (screenshots, console logs, network trace).

### Tips

- Use `pnpm dev:playwright` to keep a live dev server + Playwright launcher handy when iterating.
- Background worker logs appear in the Chrome DevTools “service worker” console; open it via `chrome://extensions` if a spec needs deeper debugging.
- Clipboard writes require a user gesture in Chromium; specs mirror the formatted preview into the OS clipboard via `tests/e2e/helpers/clipboard.ts` so assertions and cleanup remain deterministic.
- Helpers in `tests/e2e/helpers/background-bridge.ts` expose reset hooks (`resetPreviewState`, `resetHotkeyDiagnostics`, etc.) for multi-step flows—call them before issuing another copy request to avoid stale assertions.
