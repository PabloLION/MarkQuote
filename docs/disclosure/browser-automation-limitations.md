# Browser Automation Harness Evaluation

## Why We Currently Use Playwright
- **Unified stack:** We already maintain extension-specific Playwright fixtures (persistent Chromium context, service-worker discovery). Swapping harnesses would duplicate that work.
- **Robust DOM automation:** Playwright provides auto-waiting, tracing, and cross-platform runners, covering the majority of our extension logic: popup UI, background messaging, context menus, hotkey flows, and options page interactions.
- **CI parity:** Playwright integrates cleanly with our existing test commands (`pnpm test:e2e`), GitHub Actions, and artifacts (trace viewer), so keeping it minimizes infrastructure churn.

## Capability Gap
- **Toolbar click limitation:** Playwright (like Puppeteer, Selenium/WebDriver, and other CDP-based tools) cannot click the Chrome toolbar/pinned action. The browser UI sits outside the exposed DOM, and both Google and Microsoft intentionally block automation from touching browser chrome for security reasons.
- **What we can test today:** Popup behavior via direct navigation to `chrome-extension://<id>/popup.html`, background pipelines through runtime messages, context-menu flows, keyboard shortcut handling, and end-to-end copies initiated by the popup itself.
- **What remains manual/untested:** The literal act of a user clicking the toolbar icon to open the popup. We cover downstream effects (popup ready handshake, fallback timers) but not the click gesture itself.

## Harness Alternatives Investigated
| Harness | Strengths | Limitation for Toolbar-Control |
| --- | --- | --- |
| **Playwright** | Modern API, persistent context support, headless Chromium with extensions | Cannot interact with browser chrome (toolbar buttons, omnibox). |
| **Puppeteer** | Native CDP control, similar extension support | Same limitation—no toolbar UI access. |
| **Selenium / ChromeDriver** | Mature ecosystem, language flexibility | ChromeDriver warns "Operation not supported when using remote debugging" for toolbar actions. |
| **WebdriverIO / Taiko** | Additional syntactic sugar on top of WebDriver/CDP | Inherits the same restrictions as underlying engines. |

## Options Beyond Browser Automation
- **OS-level UI automation:** On macOS, use AppleScript or accessibility APIs; on Windows, WinAppDriver/AutoHotkey/pywinauto. Pros: can click the real toolbar icon. Cons: fragile, platform-specific, harder to run in CI.
- **Chrome Automation API (Kiosk scenarios):** Requires special flags and only works on Chrome OS; not practical for cross-platform testing.
- **Keyboard shortcut focus:** Assign a global shortcut to the action and trigger it via OS automation. This still needs platform automation to send the keystroke.

## Decision
- **Continue with Playwright** for all high-value end-to-end coverage (popup, background copy pipeline, context menu, hotkey fallback, error logging).
- **Document the toolbar-action gap** so manual QA covers it before releases.
- **Revisit** OS-level automation only if user feedback demands automated toolbar validation.
