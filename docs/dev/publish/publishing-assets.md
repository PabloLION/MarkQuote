# Chrome Web Store Asset Playbook

Use this guide to (re)generate the visual assets required by the Chrome Web Store. Deliverables are
committed to `docs/assets/chrome-web-store/` and referenced by the publishing checklist.

## Icon

- Source: `public/icons/icon-128.png` (exported from `assets/icon.svg`).
- Verify the icon respects the 96×96 artwork guidance in `chrome-web-store-requirements.md`.

## Small Promo Tile — 440×280

1. Open `assets/marks/mark-solid.svg` in Figma/Illustrator.
2. Create a 440×280 artboard.
3. Apply the gradient (`#1a73e8 → #0b2b64`) and overlay the MarkQuote mark.
4. Add headline: “Copy Markdown quotes in one click.”
5. Export PNG @1× → `docs/assets/chrome-web-store/promo-small-440x280.png`.

## Medium Promo Tile — 920×680 (Optional)

- Duplicate the small tile composition, scale typography to maintain 16px padding, export to
  `promo-medium-920x680.png`.

## Large Promo Tile — 1400×560 (Optional Marquee)

- Extend the gradient horizon, add screenshot inset if available, export to
  `promo-large-1400x560.png`.

## Screenshots — 1280×800

### Options Page

1. Run `pnpm dev:playwright` (launches dev surfaces without opening Chrome).
2. Visit `http://localhost:5176/options.html` in Chrome.
3. Toggle both color schemes; capture the best view via DevTools command palette `Cmd+Shift+P → Capture screenshot` with device pixel ratio 2.
4. Save to `docs/assets/chrome-web-store/screenshot-options-1280x800.png`.

### Popup Preview

1. With the dev server still running, open `http://localhost:5176/popup.html`.
2. Trigger the sample message `window.__MARKQUOTE_DEV__.emitMessage({ type: 'copied-text-preview', text: 'Example preview', url: 'https://example.com', title: 'Example title' });` to populate the preview.
3. Capture the window at 1280×800 (use responsive mode width 640, DPR 2).
4. Save to `screenshot-popup-1280x800.png`.

## Source Files

Keep editable assets under `.dev/publish/assets/` (ignored by Git). When assets are approved, copy
flattened PNGs into `docs/assets/chrome-web-store/`.

## Quality Checklist

- Text legible at 50% zoom.
- Colors align with MarkQuote palette (#1a73e8 primary, #0b2b64 accent).
- File names match the expected upload automation script inputs.
