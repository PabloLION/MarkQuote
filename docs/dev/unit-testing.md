# Unit Testing Notes

Vitest loads `tests/unit/setup.ts` before every spec. The setup calls
`ensureChromeMock` so global `chrome` stubs, storage behaviour, and `runtime`
hooks always come from the same `sinon-chrome` instance.

When individual tests need direct access to the mock, import
`getSinonChrome` from `src/dev/chrome-dev-mock` instead of requiring
`sinon-chrome` directly:

```ts
import { getSinonChrome } from '../../src/dev/chrome-dev-mock';

const sinonChrome = getSinonChrome();
```

This keeps assertions focused on the shared stub and prevents ad-hoc Chrome
mocks from drifting away from the extension runtime behaviour. If a test needs
special storage state, update the mock via `chrome.storage` APIs rather than
replacing the mock instance.
