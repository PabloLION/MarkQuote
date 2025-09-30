# Chrome Web Store Publish Script

`chrome-web-store.ts` uploads and publishes the current MarkQuote build via the Chrome Web Store
Publish API.

Usage:

```bash
pnpm publish:chrome dist/markquote-v<version>.zip
```

The script is a TypeScript CLI, so you can also run it directly with `tsx`:

```bash
pnpm tsx scripts/publish/chrome-web-store.ts dist/markquote-v<version>.zip
```

The script automatically sources `.dev/secrets/chrome-web-store.env` when present.
Environment variables (`chrome-web-store.env.example` provides a template):
- `EXTENSION_ID`
- `CLIENT_ID`
- `CLIENT_SECRET`
- `REFRESH_TOKEN`

Dependencies: Node.js 20+ (uses the built-in Fetch API).
