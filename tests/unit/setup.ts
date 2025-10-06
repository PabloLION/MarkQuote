import { beforeEach } from "vitest";
import { ensureChromeMock } from "../../src/dev/chrome-dev-mock.js";

beforeEach(async () => {
  ensureChromeMock({ persistence: "memory" });
  await chrome.storage.sync.clear();
  await chrome.storage.local.clear();
});

// Reviewer note (PR #6): navigation helper back/forward hash coverage was requested.
// The popup doesn’t manipulate history or hashes today, so we intentionally skip such tests until
// the feature exists.
