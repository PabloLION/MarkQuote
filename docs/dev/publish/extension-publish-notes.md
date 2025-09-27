# Chrome Extension IDs & Key Derivation

Chrome assigns a 32-character ID to every extension by hashing the extension's RSA public key. The
ID is stable as long as the corresponding key pair stays the same.

## How the ID Is Calculated
1. Chrome obtains the extension's RSA **public key**.
2. It runs SHA-256 over the key and maps the digest into the lowercase alphabet `a`–`p`, yielding the
   32-character ID shown in `chrome://extensions`.

## Where the Key Comes From
- **Web Store uploads:** When you upload a ZIP to the Chrome Web Store (via the Developer Dashboard
  or Publish API), Google generates and stores the RSA key pair server-side. Every customer download
  uses that key, so the ID remains consistent across all installs.
- **Packed CRX files:** The CRX header includes the public key and signature. Browsers installing the
  same CRX derive the same ID from that embedded key.
- **Unpacked (development) loads:** The first time you load an unpacked folder, Chrome generates a
  key pair per profile and caches the private key in the user profile's `Preferences` file under
  `extensions.settings.<id>.key`. If the profile is deleted or a different profile loads the same
  folder, a new key/ID pair is created.

## Implications for MarkQuote
- To obtain the authoritative Web Store ID, create a listing (even with a temporary ZIP). The ID is
  minted immediately and reused for every future upload.
- Local unpacked builds will usually have a different ID unless you embed the Web Store private key
  via the `key` field in `manifest.json`.
- If you need the Web Store ID for scripts or environment variables, copy it from the Developer
  Dashboard after the first draft upload.

### Paths for Publishing
- **Manual (dashboard) uploads:** sign in to the Chrome Web Store Developer Dashboard, click **New
  Item**, and upload a ZIP. No Google Cloud credentials are required. This is the workflow we rely on
  today and it immediately produces the permanent extension ID.
- **Publish API uploads:** enable the Chrome Web Store API in Google Cloud Console, create an OAuth
  client, obtain a refresh token, and use the REST endpoints (e.g., via
  `scripts/publish/chrome-web-store.sh`) to automate packaging and uploads. This path requires the
  additional `CLIENT_ID`, `CLIENT_SECRET`, and `REFRESH_TOKEN` secrets described in
  `docs/dev/publish/credentials.md`.

## References
- Chrome team documentation on [Extension identification](https://developer.chrome.com/docs/extensions/mv3/architecture#extension-ids)
- Chromium source: `GenerateExtensionIdFromHash`
