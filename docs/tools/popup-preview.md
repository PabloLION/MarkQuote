# Popup Preview States

Use the Vite dev server to exercise the popup without loading the full extension. The popup looks for a `state` query parameter (dev builds only) and renders the matching view so you can spot-check copy and styling in seconds.

## Quick start

1. Run `pnpm dev`.
2. Open one of the URLs below:
   - Default tip: `http://localhost:5173/popup.html?state=default`
   - Copied banner: `http://localhost:5173/popup.html?state=copied&preview=%3E%20This%20was%20addressed...`
   - Protected warning: `http://localhost:5173/popup.html?state=protected`

The `preview` parameter is optional; omit it to fall back to the sample Markdown snippet. Encode newlines as `%0A` if you paste your own text.

## Dev hub shortcut

Navigate to `http://localhost:5173/dev/popup.html` to see all three variants side-by-side. The page embeds the real popup bundle three times with the helper query strings and also provides handy links to open each state in a new tab.

These overrides only apply when `import.meta.env.DEV` is `true`, so production builds remain unaffected.
