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

- **Popup smoke:** the “Feedback” button opens the project repository in a new tab.
- **Selection → preview pipeline:** stubs a Wikipedia article, selects text, fires the background copy request, and asserts the popup preview + clipboard message. Runs in both light and dark color schemes.
- **Options editing via UI:** fills in rule fields, saves through the real form, and verifies the popup preview reflects the updated template and replacement rules in the same session.
- **Rule break / continue behavior:** seeds deterministic URL rules (UTM stripping + Amazon canonicalization), triggers the popup twice, and confirms the formatted output respects breakpoints versus continued matching.

## Running the Suite

- `pnpm test:e2e` – rebuilds the extension and runs every spec.
- `pnpm test:e2e -- --grep "selection"` – focus a subset by name.
- `pnpm exec playwright show-trace test-results/<spec>/trace.zip` – inspect failures (screenshots, console logs, network trace).

### Tips

- Use `pnpm dev:playwright` to keep a live dev server + Playwright launcher handy when iterating.
- Background worker logs appear in the Chrome DevTools “service worker” console; open it via `chrome://extensions` if a spec needs deeper debugging.
