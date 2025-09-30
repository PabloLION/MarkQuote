# Chrome Web Store Credentials Handling

The Chrome Web Store Publish API relies on four values that are stored outside of git.

| Variable        | Where to find it                                                                                                                                                                                                                                                                                                                                            | Notes                                                                                                                          |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `EXTENSION_ID`  | 1. Visit [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).<br>2. Click **Items** in the left nav.<br>3. Select the MarkQuote listing (or create a new draft by clicking **New Item** and uploading a ZIP).<br>4. Copy the 32-character ID shown in the URL (`.../detail/<id>`) or in the **Item ID** box on the right. | Draft listings immediately receive a permanent ID; reuse it for every upload.                                                  |
| `CLIENT_ID`     | 1. Open [Google Cloud Console](https://console.cloud.google.com/).<br>2. Select the project tied to MarkQuote (or create one).<br>3. Go to **APIs & Services → Credentials**.<br>4. Under **OAuth 2.0 Client IDs**, click the desktop client created for the Web Store API and copy its **Client ID**.                                                      | If no client exists, click **Create Credentials → OAuth client ID**, choose **Desktop app**, and name it `markquote-webstore`. |
| `CLIENT_SECRET` | Same dialog as `CLIENT_ID`: click the desktop client and note the **Client secret** value.                                                                                                                                                                                                                                                                  | Regenerating the secret invalidates existing refresh tokens.                                                                   |
| `REFRESH_TOKEN` | 1. Follow the consent flow in [chrome-web-store-publish-api.md](chrome-web-store-publish-api.md).<br>2. When prompted, paste the authorization code back into the token exchange request.<br>3. Copy the `refresh_token` from the JSON response.                                                                                                            | Each refresh token is bound to one `CLIENT_ID`/`CLIENT_SECRET`. Keep only the latest active token.                             |

## Storage Plan

- Store credentials in the shared 1Password vault (entry: **MarkQuote / Chrome Web Store Publish**).
- Developers needing release access copy values into `.dev/secrets/chrome-web-store.env` (ignored by git).
- Use `scripts/publish/chrome-web-store.env.example` as the onboarding template.
- Rotate secrets whenever a maintainer leaves or quarterly—update 1Password and regenerate refresh
  token via the OAuth flow described in `chrome-web-store-publish-api.md`.

## Local Usage

For a fresh setup:

1. **Create the draft listing** on the Chrome Web Store Developer Dashboard and upload any build so the item receives its permanent `EXTENSION_ID`.
2. **Enable the Chrome Web Store API** for your Google Cloud project, then create a desktop OAuth client to obtain `CLIENT_ID` and `CLIENT_SECRET`.
3. **Generate `REFRESH_TOKEN`:** follow the consent flow in `chrome-web-store-publish-api.md` using the newly created client.

Place the four values in `.dev/secrets/chrome-web-store.env` (template in
`scripts/publish/chrome-web-store.env.example`). The publish script automatically sources it when
present; extra variables can still be exported manually before invocation when needed.

## Access Control

- Only maintainers (listed in `#team-maintainers` Slack channel) have 1Password access.
- Extension ID is safe to share internally but not publicly.
- Never commit `.dev/secrets` directory or raw credential values to git history.

## Incident Response

If credentials leak or access is revoked:

1. Revoke tokens via Google Cloud Console (`OAuth 2.0 Client IDs → Delete`).
2. Generate replacements following the Publish API guide.
3. Update secrets in 1Password and notify maintainers.
