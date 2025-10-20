<!-- markdownlint-disable MD013 -->

# Hotkey Fallback Validation Tasks

- Capture clipboard state in the Playwright hotkey spec, inject a nonce into the DOM selection via the Playwright helper, confirm the clipboard remains unchanged (proving the fallback cannot write without user activation), and restore the original clipboard afterwards.
- Add diagnostics (dev-only logging or telemetry) around the fallback path to confirm when `selection.js` runs and what text it returns, especially when the toolbar icon is unpinned.
- Manually reproduce the unpinned shortcut flow with the new logging enabled to verify whether the clipboard contains the nonce; escalate if injection still fails.
- Evaluate longer-term options for a mock clipboard helper to keep tests deterministic without touching the real system clipboard.
