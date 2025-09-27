# Chrome Web Store Credentials Handling

The Chrome Web Store Publish API requires three OAuth credentials issued from the Google Cloud
Console:

- `CLIENT_ID`
- `CLIENT_SECRET`
- `REFRESH_TOKEN`

## Storage Plan
- Store credentials in the shared 1Password vault (entry: **MarkQuote / Chrome Web Store Publish**).
- Developers needing release access copy values into `.dev/secrets/chrome-web-store.env` (ignored by git).
- Use `scripts/publish/chrome-web-store.env.example` as the onboarding template.
- Rotate secrets whenever a maintainer leaves or quarterly—update 1Password and regenerate refresh
  token via the OAuth flow described in `chrome-web-store-publish-api.md`.

## Local Usage
Source the env file before running the publish script:

```bash
source .dev/secrets/chrome-web-store.env
export EXTENSION_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
scripts/publish/chrome-web-store.sh
```

## Access Control
- Only maintainers (listed in `#team-maintainers` Slack channel) have 1Password access.
- Extension ID is safe to share internally but not publicly.
- Never commit `.dev/secrets` directory or raw credential values to git history.

## Incident Response
If credentials leak or access is revoked:
1. Revoke tokens via Google Cloud Console (`OAuth 2.0 Client IDs → Delete`).
2. Generate replacements following the Publish API guide.
3. Update secrets in 1Password and notify maintainers.
