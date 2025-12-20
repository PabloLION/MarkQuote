# Extension Toolbar Automation Research

Research conducted 2025-12-20. Saved for future reference.

## Problem

Cannot automate:

- Clicking extension toolbar icons
- Pinning/unpinning extensions
- Testing popup via actual toolbar click

## Findings

### Playwright/Puppeteer/Selenium

None can click toolbar icons. This is outside browser viewport scope.

### Chrome DevTools Protocol (CDP)

- NO commands for toolbar interaction
- Extensions domain only has storage commands
- Feature request exists: chrome-devtools-mcp #96

### Extension API

- `chrome.action.pin()` - Does NOT exist
- `chrome.action.requestPinning()` - Does NOT exist
- Only read-only: `getUserSettings().isOnToolbar`
- Enterprise policy `toolbar_pin: "force_pinned"` - IT admins only

### Chrome Team Position

> "After several discussions and lengthy consideration, we think that leaving
> actions unpinned by default is the best course for our longer-term plans for
> the Chrome extension platform."

Deliberate UX decision, not missing feature.

## Current Workaround

1. Use `chrome.action.openPopup()` from service worker (Chrome 127+)
2. Navigate directly to `chrome-extension://${id}/popup.html`
3. Manual smoke tests for toolbar interactions

## Where to Propose Changes

- CDP feature: chrome-devtools-mcp issue #96
- Extension API: chromium issues #40144034
- Cross-browser: W3C WebExtensions GitHub

## Related

- `chrome.action.openPopup()` does NOT require pinning (Chrome 127+)
- Requires window focus, not pinning
- See smoke test checklist for manual verification items
