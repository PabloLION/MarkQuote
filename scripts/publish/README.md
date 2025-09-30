# Chrome Web Store Publish Script

`chrome-web-store.sh` uploads and publishes the current MarkQuote build via the Chrome Web Store
Publish API.

Usage:

```bash
scripts/publish/chrome-web-store.sh dist/markquote-v<version>.zip
```

The script automatically sources `.dev/secrets/chrome-web-store.env` when present.
Environment variables (`chrome-web-store.env.example` provides a template):
- `EXTENSION_ID`
- `CLIENT_ID`
- `CLIENT_SECRET`
- `REFRESH_TOKEN`

Dependencies: `curl`, `jq`.
