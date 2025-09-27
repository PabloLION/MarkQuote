# Chrome Web Store Store Listing

Use these values in the **Store listing** form for the Chrome Web Store dashboard. Every field below
maps to an input on the page.

## Product details

### Title
MarkQuote (sourced from `public/manifest.json -> name`).

### Summary
`copy selected text as markdown with source link.` (manifest `description`).

### Description (16,000 char max)

```text
MarkQuote helps researchers collect quotes without leaving the browser. Highlight any text, open the
MarkQuote popup, and the extension converts the selection into Markdown—ready for docs, notes, and
code comments.

**Features**
- One-click Markdown copy from the browser toolbar or context menu
- Customizable title/URL rules so links stay clean, even on content-heavy sites
- Options page with live preview, dark mode support, and default presets for Wikipedia and Amazon
- Keyboard shortcut support for faster capture

**Privacy**
MarkQuote only processes the pages you explicitly activate. It stores configuration locally and does not send data to external services.
```

### Category
Productivity → Workflow & Planning.

### Default language
English (United States).

## Graphic assets

### Store icon (128×128)
`public/icons/icon-128.png` (generated from `assets/icon.svg`).

### Screenshots (1280×800 or 640×400)
- Options page: `docs/assets/chrome-web-store/screenshot-options-1280x800.png`
- Popup preview: `docs/assets/chrome-web-store/screenshot-popup-1280x800.png`

### Small promo tile (440×280)
`docs/assets/chrome-web-store/promo-small-440x280.png`

### Marquee promo tile (1400×560, optional)
`docs/assets/chrome-web-store/promo-large-1400x560.png`

### Promo video (optional)
Leave blank for now.

## Additional fields

### Homepage URL
<https://pablolion.github.io/markquote/>

### Support URL
<https://github.com/PabloLION/MarkQuote/issues>

### Official URL
Leave unset unless Search Console verification is added.

### Mature content
No (leave unchecked).

### Item support visibility

On (so support contact is visible).

Update these values if the messaging or assets change so the listing stays consistent with the
extension. For privacy answers, see `docs/storefront/chrome-web-store/privacy.md`.
