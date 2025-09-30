# Chrome Web Store Requirements

Reference for the assets and metadata the Chrome Web Store expects when submitting MarkQuote.

## Graphic Assets

- **Icon:** 128×128 PNG (artwork ≈96×96). Source `public/icons/icon-128.png`.
- **Promo tile (small):** 440×280 PNG/JPEG (`docs/storefront/chrome-web-store/assets/promo-small-440x280.png`).
- **Promo tile (medium):** 920×680 PNG/JPEG (optional).
- **Promo tile (large/marquee):** 1400×560 PNG/JPEG (optional) (`docs/storefront/chrome-web-store/assets/promo-marquee-1400x560.png`).
- **Screenshots:** Minimum one 1280×800 PNG/JPEG to showcase core flow (see `docs/storefront/chrome-web-store/assets/screenshot-overview-1280x800.png` and `.../screenshot-options-1280x800.png`).
- **Video:** Optional YouTube demo URL.

## Listing Copy

- **Short description:** ≤132 characters.
- **Detailed description:** Markdown allowed; see `docs/storefront/chrome-web-store/store-listing.md` for approved copy.
- **Release notes:** Brief summary per version.
- **Category:** Productivity → Workflow & Planning (fits MarkQuote usage).
- **Default language:** en-US (localise copy/screenshots if we add locales).

## Policies & Links

- **Privacy policy URL:** <https://pablolion.github.io/markquote/privacy> (placeholder until published).
- **Support URL:** <https://github.com/PabloLION/MarkQuote/issues>.
- **Official URL:** Optional; link to marketing site when available.

## Submission Checklist

1. Confirm manifest version matches `package.json` version.
2. Build ZIP via `pnpm build` and archive as `dist/markquote-v<version>.zip`.
3. Run `pnpm publish:chrome` (or upload manually) and monitor response.
4. Update listing metadata and assets as needed.
5. After approval, archive assets + response JSON under `docs/releases/`.

## References

- Assets guidance: <https://developer.chrome.com/docs/webstore/images/>
- Store listing fields: <https://developer.chrome.com/docs/webstore/cws-dashboard-listing/>
- Privacy tab checklist: <https://developer.chrome.com/docs/webstore/cws-dashboard-privacy/>
- Publish API: <https://developer.chrome.com/docs/webstore/using_webstore_api/>
