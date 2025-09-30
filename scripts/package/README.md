# Package Scripts

TypeScript automation invoked through `package.json`.

- `bundle.ts` — runs the release build and produces `.dev/releases/markquote-v<version>.zip` for manual upload.
- `prepare.ts` — installs git hooks and enforces local repo policies (e.g., `merge.ff=false`).
- `capture-store-assets.ts` — entry point that orchestrates Chrome Web Store asset generation (`pnpm tools:chrome-assets`).
- `tools/chrome-assets/options.ts`, `overview.ts`, `promo-small.ts`, `promo-marquee.ts` — CLI entrypoints for
  the store asset tooling. Individual commands:
  - `pnpm tools:chrome-assets:options`
  - `pnpm tools:chrome-assets:overview`
  - `pnpm tools:chrome-assets:promo-small`
  - `pnpm tools:chrome-assets:promo-marquee`
  Append `--confirm` to any of the above to pause before the screenshot is captured.
- `dev/playwright-dev.ts` — launches Vite and a Playwright-driven Chrome instance for local QA.
- `helpers/zip-folder.ts` — shared utility used by the bundle script to zip the build output.

Scripts are executed with `tsx`, so each file can also be run directly, e.g. `pnpm tsx scripts/package/bundle.ts`.
