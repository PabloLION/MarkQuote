# Publishing Checklist

This guide covers the steps required to ship MarkQuote to the Chrome Web Store with the manifest tightened to least-privilege defaults.

## 1. Pre-flight
- Confirm you are on a release branch with the correct version bump in `package.json` and `public/manifest.json`.
- Ensure release assets are refreshed via `docs/dev/publish/publishing-assets.md`; verify PNGs exist in `docs/assets/chrome-web-store/`.
- Review credentials plan in `docs/dev/publish/credentials.md` and confirm local `.dev/secrets/chrome-web-store.env` is up to date.
- Verify the permission set remains `contextMenus`, `activeTab`, `scripting`, `storage` and that no additional host permissions were introduced.

## 2. Build & QA
1. `pnpm install`
2. `pnpm tsc --noEmit`
3. `pnpm test`
4. `pnpm test:e2e --project=chromium-extension`
5. `pnpm build`
6. Manual smoke test using the packaged extension:
   - Load `dist/` via chrome://extensions → Load unpacked.
   - Confirm context menu, keyboard shortcut, and popup flows copy markdown on a real HTTPS page.
   - Open the options page and validate rule edits persist.

## 3. Bundle
- Preferred: `pnpm bundle` (runs the release bundle script, verifies manifest version, and produces
  `dist/markquote-v<version>.zip`). Use this artifact when drafting the GitHub Release.
- If packaging manually, zip the `dist/` folder and upload the archive directly to the GitHub
  Release draft; keeping duplicates under `.dev/releases/` is optional.

## 4. Refresh Store Assets
- `pnpm tools:chrome-assets` (use `--confirm` to review each capture). The script opens the
  installed extension in Chromium, captures the popup/options flow, and updates the promo tiles under
  `docs/storefront/chrome-web-store/assets/`.

## 5. Store Submission / Automation
- Source `.dev/secrets/chrome-web-store.env` (or export env vars) and run `pnpm publish:chrome dist/markquote-v<version>.zip`.
- Inspect the script output; on success capture the JSON response in the GitHub Release draft.
- Attach the bundled ZIP and changelog to the GitHub Release (marks our canonical archive).
- If manual submission is required, sign in to the Chrome Web Store Developer Dashboard, upload the ZIP, and publish.
- Update listing copy, privacy policy, support URL, and release notes as needed.

## 6. Post-Submission
- Tag the release in Git (`git tag v<version>` and `git push origin v<version>`).
- Publish release notes (GitHub Releases or project docs).
- Monitor store feedback and crash reports for regressions.

## 7. Rollback Plan
- Keep the previous ZIP and manifest on hand.
- If a regression is discovered, yank the newest listing and re-submit the prior build while hotfixing the issue.
