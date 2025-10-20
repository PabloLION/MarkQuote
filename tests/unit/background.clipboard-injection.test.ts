import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CLIPBOARD_MAX_BYTES,
  copyTextWithNavigatorClipboard,
} from "../../src/background/clipboard-injection.js";

describe("background/clipboard-injection", () => {
  const originalNavigator = navigator;

  beforeEach(() => {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: originalNavigator,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: originalNavigator,
    });
    vi.restoreAllMocks();
  });

  it("returns ok when navigator.clipboard.writeText resolves", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { clipboard: { writeText } },
    });

    await expect(copyTextWithNavigatorClipboard("example")).resolves.toEqual({ ok: true });
    expect(writeText).toHaveBeenCalledWith("example");
  });

  it("returns error details when navigator.clipboard.writeText rejects", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { clipboard: { writeText } },
    });

    await expect(copyTextWithNavigatorClipboard("fallback")).resolves.toEqual({
      ok: false,
      error: "denied",
    });
    expect(warnSpy).toHaveBeenCalledWith(
      "[MarkQuote] navigator.clipboard.writeText rejected",
      "denied",
    );
  });

  it("returns failure when clipboard API is unavailable", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {},
    });

    await expect(copyTextWithNavigatorClipboard("missing")).resolves.toEqual({
      ok: false,
      error: "Clipboard API unavailable",
    });
    expect(warnSpy).toHaveBeenCalledWith("[MarkQuote] navigator.clipboard.writeText unavailable");
  });

  it("stringifies non-error rejections", async () => {
    const writeText = vi.fn().mockRejectedValue("failure");
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { clipboard: { writeText } },
    });

    await expect(copyTextWithNavigatorClipboard("string")).resolves.toEqual({
      ok: false,
      error: "failure",
    });
  });

  it("refuses to write payloads that exceed the byte limit", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const oversized = "a".repeat(CLIPBOARD_MAX_BYTES + 1);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { clipboard: { writeText } },
    });

    await expect(copyTextWithNavigatorClipboard(oversized)).resolves.toEqual({
      ok: false,
      error: "Clipboard payload exceeds size limit",
    });
    expect(writeText).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      "[MarkQuote] Refusing to copy oversized clipboard payload",
      {
        bytes: CLIPBOARD_MAX_BYTES + 1,
        limit: CLIPBOARD_MAX_BYTES,
      },
    );
  });
});
