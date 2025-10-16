# Background Worker Refactor Follow-Up

- The clipboard pipeline still runs inside the background worker
  (`src/background/index.ts` + `copy-pipeline.ts`).
- Long term, move clipboard orchestration into foreground surfaces (popup +
  injected scripts) so the service worker is no longer required for core logic.
- Once that migration happens, keep the background script limited to minimal
  routing (or remove it entirely if Chrome APIs allow).
- Track this as a dedicated refactor story after the clipboard fallbacks are
  fixed.
