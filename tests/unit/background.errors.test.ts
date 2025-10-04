import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ACTIVE_TAB_PERMISSION_MESSAGE,
  ERROR_STORAGE_KEY,
} from "../../src/background/constants.js";
import { ERROR_CONTEXT } from "../../src/background/error-context.js";
import {
  clearStoredErrors,
  getStoredErrors,
  initializeBadgeFromStorage,
  recordError,
} from "../../src/background/errors.js";
import { getSinonChrome } from "../../src/dev/chrome-dev-mock.js";

const sinonChrome = getSinonChrome();

const originalChrome = globalThis.chrome;
let badgeTextMock: ReturnType<typeof vi.fn>;
let badgeBackgroundMock: ReturnType<typeof vi.fn>;

describe("background/errors", () => {
  beforeEach(() => {
    sinonChrome.reset();
    sinonChrome.storage.local.get.resolves({ [ERROR_STORAGE_KEY]: [] });
    sinonChrome.storage.local.set.resolves();
    badgeTextMock = vi.fn().mockResolvedValue(undefined);
    badgeBackgroundMock = vi.fn().mockResolvedValue(undefined);
    (sinonChrome as unknown as { action?: typeof chrome.action }).action = {
      setBadgeText: badgeTextMock,
      setBadgeBackgroundColor: badgeBackgroundMock,
    } as unknown as typeof chrome.action;

    globalThis.chrome = sinonChrome as unknown as typeof chrome;
  });

  afterEach(() => {
    globalThis.chrome = originalChrome;
    vi.restoreAllMocks();
  });

  it("stores newest error at the front and caps the log at 10 entries", async () => {
    const existing = Array.from({ length: 12 }, (_, index) => ({
      message: `old-${index}`,
      context: ERROR_CONTEXT.InjectSelectionScript,
      timestamp: index,
    }));

    sinonChrome.storage.local.get.resolves({ [ERROR_STORAGE_KEY]: existing });
    const setSpy = sinonChrome.storage.local.set;

    await recordError(ERROR_CONTEXT.InjectSelectionScript, new Error("latest failure"));

    expect(setSpy.calledOnce).toBe(true);
    const payload = setSpy.firstCall?.args?.[0] as { [ERROR_STORAGE_KEY]: unknown };
    const stored = payload[ERROR_STORAGE_KEY] as Array<{ message: string }>;
    expect(stored.length).toBe(10);
    expect(stored[0].message).toContain("latest failure");
  });

  it("suppresses transient runtime disconnect errors", async () => {
    await recordError(ERROR_CONTEXT.QueryTabsForCopy, "Receiving end does not exist.");
    expect(sinonChrome.storage.local.set.called).toBe(false);
  });

  it("skips protected page injection errors", async () => {
    await recordError(ERROR_CONTEXT.InjectSelectionScript, "Cannot access contents of the page.", {
      tabUrl: "chrome://settings",
    });
    expect(sinonChrome.storage.local.set.called).toBe(false);
  });

  it("decorates permission errors with guidance and source metadata", async () => {
    sinonChrome.storage.local.get.resolves({ [ERROR_STORAGE_KEY]: [] });
    await recordError(ERROR_CONTEXT.InjectSelectionScript, "must request permission", {
      tabUrl: "https://example.com/article",
      source: "popup",
    });

    const payload = sinonChrome.storage.local.set.firstCall?.args?.[0] as {
      [ERROR_STORAGE_KEY]: Array<{ message: string }>;
    };
    const entry = payload[ERROR_STORAGE_KEY][0];
    expect(entry.message).toContain("must request permission");
    expect(entry.message).toContain(ACTIVE_TAB_PERMISSION_MESSAGE);
    expect(entry.message).toContain("source: popup");
  });

  it("initializes badge count from stored errors", async () => {
    sinonChrome.storage.local.get.resolves({
      [ERROR_STORAGE_KEY]: [
        { message: "boom", context: ERROR_CONTEXT.InitializeOptions, timestamp: 1 },
      ],
    });

    await initializeBadgeFromStorage();

    expect(badgeTextMock).toHaveBeenCalledWith({ text: "1" });
  });

  it("clears stored errors and resets badge", async () => {
    const setSpy = sinonChrome.storage.local.set;
    await clearStoredErrors();
    expect(setSpy.calledWith({ [ERROR_STORAGE_KEY]: [] })).toBe(true);
    expect(badgeTextMock).toHaveBeenCalledWith({ text: "" });
  });

  it("handles storage failures when clearing errors", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    sinonChrome.storage.local.set.rejects(new Error("set failed"));
    await clearStoredErrors();
    expect(consoleSpy).toHaveBeenCalled();
  });

  it("filters malformed stored errors", async () => {
    sinonChrome.storage.local.get.resolves({
      [ERROR_STORAGE_KEY]: [{ message: "ok" }, { bad: true }],
    });
    const errors = await getStoredErrors();
    expect(errors.length).toBe(1);
  });
});
