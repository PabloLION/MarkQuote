import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeClipboardTextFromBackground } from "../../src/background/background-clipboard.js";

const originalNavigator = globalThis.navigator;
const originalChrome = globalThis.chrome;

function resetGlobals() {
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: originalNavigator,
  });
  globalThis.chrome = originalChrome;
}

describe("background/writeClipboardTextFromBackground", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetGlobals();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetGlobals();
  });

  it("returns true when navigator clipboard write succeeds", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {
        clipboard: { writeText },
      } as unknown as Navigator,
    });

    globalThis.chrome = undefined as unknown as typeof chrome;

    await expect(writeClipboardTextFromBackground("example")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("example");
  });

  it("falls back to chrome clipboard when navigator write fails", async () => {
    const navigatorWrite = vi.fn().mockRejectedValue(new Error("navigator failure"));
    const chromeWrite = vi.fn().mockResolvedValue(undefined);
    const consoleSpy = vi.spyOn(console, "debug").mockImplementation(() => {});

    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {
        clipboard: { writeText: navigatorWrite },
      } as unknown as Navigator,
    });

    globalThis.chrome = {
      clipboard: {
        writeText: chromeWrite,
      },
    } as unknown as typeof chrome;

    await expect(writeClipboardTextFromBackground("fallback")).resolves.toBe(true);

    expect(navigatorWrite).toHaveBeenCalledTimes(1);
    expect(chromeWrite).toHaveBeenCalledWith("fallback");
    expect(consoleSpy).toHaveBeenCalledWith(
      "[MarkQuote] Background clipboard navigator.clipboard.writeText failed",
      expect.any(Error),
    );
  });

  it("returns false when both clipboard helpers fail", async () => {
    const navigatorWrite = vi.fn().mockRejectedValue(new Error("navigator failure"));
    const chromeWrite = vi.fn().mockImplementation(() => {
      throw new Error("chrome failure");
    });
    const consoleSpy = vi.spyOn(console, "debug").mockImplementation(() => {});

    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {
        clipboard: { writeText: navigatorWrite },
      } as unknown as Navigator,
    });

    globalThis.chrome = {
      clipboard: {
        writeText: chromeWrite,
      },
    } as unknown as typeof chrome;

    await expect(writeClipboardTextFromBackground("fail")).resolves.toBe(false);

    expect(navigatorWrite).toHaveBeenCalledTimes(1);
    expect(chromeWrite).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledTimes(2);
  });
});
