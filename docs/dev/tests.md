# Automated Test Coverage

## Execution Commands

- `pnpm test:unit` — runs Vitest with coverage across `tests/unit/**`.
- `pnpm exec playwright test --project=chromium-extension` — runs the Playwright suite in headless Chromium with the packaged extension.
- `pnpm test:e2e` — convenience task that builds the extension and executes every Playwright project defined in `playwright.config.ts`.

## Unit Suites (Vitest)

| Scenario                                                                                      | Location                                      |
| --------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Background copy pipeline queueing, popup retry handshake                                      | `tests/unit/background.copy-pipeline.test.ts` |
| Background error logging, badge updates, protected-page filtering                             | `tests/unit/background.errors.test.ts`        |
| E2E bridge message handlers (trigger-command, context copy, error log helpers, storage reset) | `tests/unit/background.e2e.test.ts`           |
| Popup copy-flow messaging and clipboard fallbacks                                             | `tests/unit/popup.copy-flow.test.ts`          |
| Popup DOM bootstrap (required elements)                                                       | `tests/unit/popup.dom.test.ts`                |
| Options controllers (drag/drop, rule persistence, DOM rendering)                              | `tests/unit/options.*.test.ts`                |
| Entry-point loaders for popup/options                                                         | `tests/unit/entries.*.test.ts`                |
| Markdown conversion helpers                                                                   | `tests/unit/converter.test.ts`                |

## End-to-End Flows (Playwright)

Instead of an isolated table, the following graph outlines the shared setup and branching user flows the Playwright specs exercise. Nodes with multiple outgoing edges represent points where different user actions reuse the same groundwork.

```mermaid
flowchart TD
    A["Launch extension context<br>`launchExtensionContext`"] --> B["Route test page / seed storage"]
    B --> C["Open content tab<br>prepare selection or stub"]
    C --> D["Trigger copy source"]

    D --> D1["Popup message (request-selection-copy)<br>`tests/e2e/copy-selection.spec.ts`"]
    D --> D2["Hotkey command (toolbar pinned)<br>`tests/e2e/copy-selection.spec.ts`"]
    D --> D3["Hotkey fallback (action unpinned)<br>`tests/e2e/hotkey-flow.spec.ts`"]
    D --> D4["Context menu request<br>`tests/e2e/context-menu-flow.spec.ts`"]

    D1 --> E["Preview rendered & clipboard asserted"]
    D2 --> E
    D3 --> E
    D4 --> E

    E --> F["Validate background state<br>(preview text, error log, badge)"]
    F --> G["Cleanup via shared `afterEach`<br>(`activeCleanup` closes context)"]
```

### Flow Highlights

- **Shared setup**: every spec launches a fresh persistent-context Chromium profile, navigates to the test page, and prepares a selection (either by DOM manipulation or background stub via `primeSelectionStub`).
- **Trigger stage** (`D` above) branches per user action:
  - `tests/e2e/copy-selection.spec.ts` covers popup requests (`chrome.runtime.sendMessage` on load) and the standard hotkey path (action pinned).
  - `tests/e2e/hotkey-flow.spec.ts` forces the action to appear unpinned so the background logs `HotkeyOpenPopup` and falls back to direct copy without opening the popup. The test verifies both the copied preview and the recorded warning.
  - `tests/e2e/context-menu-flow.spec.ts` simulates the context-menu request by calling the background bridge, ensuring the preview is generated and no errors are logged.
- **Validation**: all flows assert the formatted markdown returned by `e2e:get-last-formatted` and check the relevant side effects (badge/errors where applicable). Clipboard success is accepted when the preview text matches—actual OS clipboard access remains outside automated scope.
- **Cleanup**: `test.afterEach` stores a disposer in `activeCleanup` so every Playwright spec closes its persistent context and temporary user data dir.

## Upcoming Coverage (Story 3.9)

1. **Error log lifecycle** — seed errors through the bridge, confirm the badge and popup list reflect them, then clear the log and verify badge reset.
2. **First-run onboarding** — reset storage to defaults, open the popup without visiting options, trigger a copy, and assert the default template/preview succeeds without prior configuration.
