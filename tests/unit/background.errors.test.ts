import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ERROR_STORAGE_KEY } from "../../src/background/constants.js";
import { ERROR_CONTEXT } from "../../src/background/error-context.js";
import { recordError } from "../../src/background/errors.js";
import { getSinonChrome } from "../../src/dev/chrome-dev-mock.js";

const sinonChrome = getSinonChrome();

const originalChrome = globalThis.chrome;

describe("background/errors", () => {
  beforeEach(() => {
    sinonChrome.reset();
    sinonChrome.storage.local.get.resolves({ [ERROR_STORAGE_KEY]: [] });
    sinonChrome.storage.local.set.resolves();

    const chromeWithAction = sinonChrome as unknown as {
      action?: {
        setBadgeText: ReturnType<typeof vi.fn>;
        setBadgeBackgroundColor: ReturnType<typeof vi.fn>;
      };
    };
    if (!chromeWithAction.action) {
      chromeWithAction.action = {
        setBadgeText: vi.fn().mockResolvedValue(undefined),
        setBadgeBackgroundColor: vi.fn().mockResolvedValue(undefined),
      };
    } else {
      chromeWithAction.action.setBadgeText.mockResolvedValue(undefined);
      chromeWithAction.action.setBadgeBackgroundColor.mockResolvedValue(undefined);
    }

    globalThis.chrome = chromeWithAction as unknown as typeof chrome;
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
});
