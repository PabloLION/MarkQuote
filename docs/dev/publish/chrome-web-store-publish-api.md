# Chrome Web Store Publish API (Direct REST Guide)

Use these steps to ship a new version of MarkQuote via the official Chrome Web Store Publish API.
All credentials live outside the repo (see `credentials.md`).

## 1. Enable API & Create OAuth Credentials

1. Open the [Google Cloud Console](https://console.cloud.google.com/), select or create a project.
2. Enable **Chrome Web Store API** under **APIs & Services → Library**.
3. Configure the OAuth consent screen (External, supply support + developer emails, add yourself as
   test user).
4. Create an OAuth Client ID (Application type: Desktop app) and store `CLIENT_ID`, `CLIENT_SECRET`.

## 2. Generate Refresh Token (one-time)

```bash
open "https://accounts.google.com/o/oauth2/auth?response_type=code&scope=https://www.googleapis.com/auth/chromewebstore&client_id=${CLIENT_ID}&redirect_uri=urn:ietf:wg:oauth:2.0:oob"
```

Log in with the publisher account, approve access, copy the code, exchange it for tokens:

```bash
curl "https://accounts.google.com/o/oauth2/token" \
  -d "client_id=${CLIENT_ID}" \
  -d "client_secret=${CLIENT_SECRET}" \
  -d "code=${AUTH_CODE}" \
  -d "grant_type=authorization_code" \
  -d "redirect_uri=urn:ietf:wg:oauth:2.0:oob"
```

Store the returned `refresh_token` securely.

## 3. Helper Script (token minting)

Create `.dev/secrets/chrome-webstore-token.sh`:

```bash
CLIENT_ID=...
CLIENT_SECRET=...
REFRESH_TOKEN=...

access_token() {
  curl -s "https://accounts.google.com/o/oauth2/token" \
    -d "client_id=$CLIENT_ID" \
    -d "client_secret=$CLIENT_SECRET" \
    -d "refresh_token=$REFRESH_TOKEN" \
    -d "grant_type=refresh_token" | jq -r '.access_token'
}
```

Source the file and call `TOKEN=$(access_token)` before invoking the API. The repository ships
`scripts/publish/chrome-web-store.ts` (exposed via `pnpm publish:chrome`) which wraps these steps when the environment variables are set.

## 4. Upload ZIP

```bash
TOKEN=$(access_token)
ZIP=dist/markquote.zip
curl -H "Authorization: Bearer $TOKEN" -H "x-goog-api-version: 2" \
     -X PUT -T "$ZIP" \
     "https://www.googleapis.com/upload/chromewebstore/v1.1/items/${EXTENSION_ID}"
```

Check the response for `"uploadState":"SUCCESS"`. If `IN_PROGRESS`, poll the items endpoint until success.

## 5. Publish

```bash
curl -H "Authorization: Bearer $TOKEN" -H "x-goog-api-version: 2" -X POST \
  "https://www.googleapis.com/chromewebstore/v1.1/items/${EXTENSION_ID}/publish?publishTarget=default"
```

Optional parameters: `publishTarget=trustedTesters`, `deployPercentage=25`.

## 6. Scripted Workflow

Run `pnpm publish:chrome dist/markquote.zip` after exporting the required env vars or
sourcing `.dev/secrets/chrome-web-store.env`.

## 7. References

- REST docs: <https://developer.chrome.com/docs/webstore/using_webstore_api/>
- Items resource: <https://developer.chrome.com/docs/webstore/webstore_api/items>
- OAuth: <https://developers.google.com/identity/protocols/oauth2>
