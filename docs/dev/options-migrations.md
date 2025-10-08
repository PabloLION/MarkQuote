# Options Storage Migration Plan

MarkQuote stores user templates and rules in `chrome.storage.sync`. The current schema is defined by `OptionsPayload` in `src/options-schema.ts`. This document captures how we migrate and validate existing data when the schema changes.

## First-Run Initialisation

- When no options exist (`storage.sync` returns empty collections), we seed the defaults from `DEFAULT_OPTIONS`.
- The seeding happens in `ensureOptionsInitialized()` (`src/background/index.ts`) during background startup.

## Legacy Payload Normalisation

- `normalizeStoredOptions(snapshot)` converts older representations to the current `OptionsPayload`.
- If data predates versioning (missing `version`), we normalise it in place without surfacing an error to the user.
- Failed validation after normalisation results in writing the defaults; this scenario is not expected once migrations are in place.

## Schema Version Bumps

- Increment `CURRENT_OPTIONS_VERSION` whenever the schema changes.
- Add any required transformations inside `normalizeStoredOptions`.
- Keep this document updated with the rationale for the bump and steps taken.

### Version History

| Version | Summary                                                     |
| ------- | ----------------------------------------------------------- |
| 1       | Base schema: `format`, `titleRules`, `urlRules`.            |
| 2       | Normalised legacy combined rule support and template tweaks.|

## Testing Checklist

1. Install extension fresh — should seed defaults without logging `invalid-options-payload`.
2. Upgrade from previous version — ensure rules migrate and previews continue to render.
3. Corrupt storage intentionally — verify defaults are restored and errors logged.

Update this document alongside schema changes so manual testers and future migrations have a clear reference.
