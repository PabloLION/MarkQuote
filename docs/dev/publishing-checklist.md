# Publishing Checklist

This guide covers the steps required to ship MarkQuote to the Chrome Web Store with the manifest tightened to least-privilege defaults.

## 1. Pre-flight
- Confirm you are on a release branch with the correct version bump in `package.json` and `public/manifest.json`.
- Ensure release assets (icons, screenshots, promo copy) are updated.
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

## 3. Package
- From the repo root run:
  ```bash
  cd dist
  zip -r ../markquote-v<version>.zip .
  cd ..
  ```
- Stage the ZIP for upload and archive it in release assets.

## 4. Store Submission
- Sign in to the Chrome Web Store Developer Dashboard.
- Create a draft item (or upload a new version).
- Upload the packaged ZIP, fill in release notes, and double-check visibility/region settings.
- Review privacy policy, support URL, and screenshots for accuracy.

## 5. Post-Submission
- Tag the release in Git (`git tag v<version>` and `git push origin v<version>`).
- Publish release notes (GitHub Releases or project docs).
- Monitor store feedback and crash reports for regressions.

## 6. Rollback Plan
- Keep the previous ZIP and manifest on hand.
- If a regression is discovered, yank the newest listing and re-submit the prior build while hotfixing the issue.
