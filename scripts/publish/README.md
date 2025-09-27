# Chrome Web Store Publish Script

`chrome-web-store.sh` uploads and publishes the current MarkQuote build via the Chrome Web Store
Publish API.

Usage:

```bash
source .dev/secrets/chrome-web-store.env
scripts/publish/chrome-web-store.sh dist/markquote-v<version>.zip
```

Environment variables (`chrome-web-store.env.example` provides a template):
- `EXTENSION_ID`
- `CLIENT_ID`
- `CLIENT_SECRET`
- `REFRESH_TOKEN`

Dependencies: `curl`, `jq`.
