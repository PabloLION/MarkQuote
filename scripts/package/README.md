# Package Scripts

TypeScript automation invoked through `package.json`.

- `bundle.ts` — runs the release build and produces `docs/releases/markquote-v<version>.zip`.
- `prepare.ts` — installs git hooks and enforces local repo policies (e.g., `merge.ff=false`).
- `dev/playwright-dev.ts` — launches Vite and a Playwright-driven Chrome instance for local QA.
- `helpers/zip-folder.ts` — shared utility used by the bundle script to zip the build output.

Scripts are executed with `tsx`, so each file can also be run directly, e.g. `pnpm tsx scripts/package/bundle.ts`.
