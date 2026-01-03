# Chrome Web Store Credentials Handling

The Chrome Web Store Publish API relies on four values stored outside of git.

| Variable | Description |
|----------|-------------|
| `EXTENSION_ID` | 32-character ID from Chrome Web Store dashboard URL |
| `CLIENT_ID` | OAuth 2.0 Web application client ID |
| `CLIENT_SECRET` | OAuth 2.0 client secret |
| `REFRESH_TOKEN` | Long-lived token for automated access |

## Current Setup

- **Project:** markquote-chrome-extension (Google Cloud)
- **OAuth Client:** markquote-webstore-web (Web application type)
- **Redirect URI:** `https://developers.google.com/oauthplayground`
- **Extension ID:** `dkkofldploogohjfehdnibphccbhjjgb`

## Regenerating the Refresh Token

The refresh token expires in **7 days** while the OAuth consent screen is in
Testing mode. When it expires, follow these steps to regenerate:

### Quick Steps (2 minutes)

1. Open [OAuth Playground](https://developers.google.com/oauthplayground)

2. Click the **gear icon (⚙️)** in the top right:
   - Check **"Use your own OAuth credentials"**
   - Client ID: (copy from `.dev/secrets/chrome-web-store.env`)
   - Client Secret: (copy from `.dev/secrets/chrome-web-store.env`)
   - Close settings

3. **Step 1 - Select & authorize APIs:**
   - In the input box, enter: `https://www.googleapis.com/auth/chromewebstore`
   - Click **Authorize APIs**
   - Sign in with publisher Google account and approve

4. **Step 2 - Exchange authorization code for tokens:**
   - Click **Exchange authorization code for tokens**
   - Copy the **Refresh token** value

5. Update `.dev/secrets/chrome-web-store.env`:

   ```bash
   export REFRESH_TOKEN="<paste-new-token-here>"
   ```

6. Test it works:

   ```bash
   pnpm publish:chrome releases/markquote-v<version>.zip
   ```

## Making the Token Permanent (Optional)

To avoid regenerating every 7 days, publish the OAuth consent screen:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select project **markquote-chrome-extension**
3. Navigate to **APIs & Services → OAuth consent screen**
4. Click **Publish App**
5. Confirm the prompt

**Note:** Publishing moves the app from Testing to Production. For the
`chromewebstore` scope, Google typically does not require verification since
it's not a sensitive scope. After publishing, refresh tokens become permanent.

## Storage

- Credentials stored in `.dev/secrets/chrome-web-store.env` (gitignored via `/.dev`)
- Template available at `scripts/package/publish/chrome-web-store.env.example`
- The publish script automatically sources the env file when present

## Fresh Setup (New Machine)

1. **Get EXTENSION_ID:** Visit the
   [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole),
   click on MarkQuote, copy ID from URL (`.../detail/<id>`)

2. **Get CLIENT_ID/SECRET:** In
   [Google Cloud Console](https://console.cloud.google.com/) →
   APIs & Services → Credentials → click `markquote-webstore-web`

3. **Generate REFRESH_TOKEN:** Follow "Regenerating the Refresh Token" above

4. **Create env file:**

   ```bash
   cp scripts/package/publish/chrome-web-store.env.example \
      .dev/secrets/chrome-web-store.env
   # Edit and fill in all four values
   ```

## Security Notes

- Never commit `.dev/secrets/` directory (already in `.gitignore`)
- Extension ID is not sensitive (public in store URL)
- CLIENT_SECRET is sensitive but useless without Google account approval
- REFRESH_TOKEN is most sensitive - grants publish access

## If Credentials Are Compromised

1. Go to Google Cloud Console → APIs & Services → Credentials
2. Delete the compromised OAuth client
3. Create a new Web application OAuth client
4. Add `https://developers.google.com/oauthplayground` as redirect URI
5. Regenerate refresh token via OAuth Playground
6. Update `.dev/secrets/chrome-web-store.env`
