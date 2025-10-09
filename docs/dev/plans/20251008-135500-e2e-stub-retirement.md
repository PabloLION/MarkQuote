# Plan: Retire E2E Selection Stub & Verify Real Clipboard Flow

## Research Tasks (no code commits)

- **R1. Command + activeTab behaviour:** Gather Chromium docs or bug
  threads describing whether keyboard shortcuts triggered
  programmatically grant `activeTab`. Capture direct citations.
- **R2. Clipboard permissions:** Confirm whether `chrome.clipboard`
  with `"clipboard"` / `"clipboardWrite"` lets the background copy
  without a user activation and note any MV3 prompts.

## Implementation Tasks (each must land as its own atomic commit)

1. **[x] Prototype real shortcut in Playwright**
   - Update the hotkey spec to send the actual keyboard shortcut via
     Playwright/DevTools.
   - Log whether `handleHotkeyCommand` receives a tab ID and whether
     `chrome.scripting.executeScript` succeeds.
2. **[x] Decide & wire clipboard strategy**
   - If Chromium still blocks the write, add the clipboard permission
     and switch the fallback copy to `chrome.clipboard.writeText` in
     the background worker.
   - Otherwise, rely on the new shortcut helper and keep existing
     permissions.
3. **[x] Rewrite E2E flows**
   - Remove `primeSelectionStub` / `consumeSelectionStub` and the
     related message types.
   - Refactor helpers and specs to operate on real DOM selections
     using Playwright DOM APIs (`selectElementText`, clipboard
     assertions, etc.).
4. **[x] Guard production builds**
   - Remove `isE2ETest` branches from runtime logic and centralise
     E2E hooks so production bundles always execute the same pathway.
5. **[ ] Docs & cleanup**
   - Update `docs/dev/test-coverage.md` to describe the new Arrange
     and Act steps.
   - Note the clipboard/permission decision in the relevant release
     or infrastructure docs.
