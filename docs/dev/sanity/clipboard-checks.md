# Clipboard Sanity Checks

This note explains how to verify clipboard behaviour outside the extension
bundle. Use these scripts when diagnosing regression reports or validating new
copy strategies.

## Prerequisites

- Playwright dependencies installed (`pnpm exec playwright install`).
- Host clipboard tooling available. macOS ships `pbcopy` by default. Linux
  users need `xclip` or `xsel`, and Windows relies on PowerShell cmdlets (all
  handled by `clipboardy`).

Run scripts with `pnpm exec tsx <script.ts>`.

## `scripts/sanity/chrome-clipboard.ts`

- Launches Chromium **headless** and calls `navigator.clipboard.writeText`
  inside an about:blank tab.
- Verifies that the operating system clipboard now contains a unique nonce.
- Restores the original clipboard contents when the run completes.

Use this script to confirm the host environment allows privileged clipboard
writes. Failure usually means Chrome has not granted the `clipboard-write`
permission for the origin.

```bash
pnpm exec tsx scripts/sanity/chrome-clipboard.ts
```

Sample success output:

```text
Chrome clipboard check passed (nonce: clipboard-1700000000-deadbeef)
```

## `scripts/sanity/playwright-clipboard-copy.ts`

- Launches Chromium **headed** and grants clipboard read/write for
  `https://example.com`.
- Injects a hidden textarea that listens for the `copy` event. The handler
  performs:
  1. Prevents the default copy.
  2. Generates a unique token.
  3. Calls `navigator.clipboard.writeText(token)`.
- Simulates user activation by typing and pressing `Ctrl+C`.
- Reads the clipboard in two places:
  - `navigator.clipboard.readText()` inside the page.
  - Host clipboard via `clipboardy`.
- Restores the original clipboard afterwards.

This flow mimics how the extension will operate: the copy helper runs within the
tab immediately after a user gesture, relies solely on
`navigator.clipboard.writeText`, and succeeds without using `document.execCommand`.

```bash
pnpm exec tsx scripts/sanity/playwright-clipboard-copy.ts
```

Sample success output:

```text
Page clipboard read: playwright-clipboard-1700000000
Handler stored: playwright-clipboard-1700000000
Host clipboard read: playwright-clipboard-1700000000
```

If either script fails, capture the console output and log it in a development
log (`docs/dev/logs/`). That context helps determine whether the issue stems
from permissions, host tooling, or a real regression in the extension pipeline.
