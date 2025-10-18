import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CLIPBOARD_MAX_BYTES,
  copySelectionToClipboard,
} from "../../src/background/clipboard-injection.js";

const encoder = new TextEncoder();

describe("background/clipboard-injection", () => {
  const originalNavigator = navigator;
  const originalExecCommand = document.execCommand;

  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: originalNavigator,
    });
    document.execCommand = originalExecCommand;
  });

  it("uses execCommand when available", () => {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {},
    });
    const execSpy = vi.fn().mockReturnValue(true);
    document.execCommand = execSpy as unknown as typeof document.execCommand;

    const result = copySelectionToClipboard("example");

    expect(execSpy).toHaveBeenCalledWith("copy");
    expect(result).toBe(true);
  });

  it("falls back to clipboard.writeText when execCommand fails", () => {
    const writeSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { clipboard: { writeText: writeSpy } },
    });
    const execSpy = vi.fn().mockReturnValue(false);
    document.execCommand = execSpy as unknown as typeof document.execCommand;

    const result = copySelectionToClipboard("fallback text");

    expect(execSpy).toHaveBeenCalledWith("copy");
    expect(writeSpy).toHaveBeenCalledWith("fallback text");
    expect(result).toBe(true);
  });

  it("returns false when execCommand is unavailable and clipboard API missing", () => {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {},
    });
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: undefined,
    });

    const result = copySelectionToClipboard("fallback");

    expect(result).toBe(false);
    expect(document.body.querySelector("textarea")).toBeNull();
  });

  it("rejects clipboard writes that exceed the size limit", () => {
    const writeSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { clipboard: { writeText: writeSpy } },
    });
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const oversized = "x".repeat(1_000_001);
    const result = copySelectionToClipboard(oversized);

    expect(result).toBe(false);
    expect(writeSpy).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      "[MarkQuote] Refusing to copy oversized clipboard payload",
      expect.objectContaining({ bytes: oversized.length }),
    );

    consoleSpy.mockRestore();
  });

  it("measures byte length when enforcing the clipboard cap", () => {
    const writeSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { clipboard: { writeText: writeSpy } },
    });
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const multibyte = "🙂";
    const bytesPerChar = encoder.encode(multibyte).length;
    const repetitions = Math.floor(CLIPBOARD_MAX_BYTES / bytesPerChar) + 1;
    const payload = multibyte.repeat(repetitions);

    const result = copySelectionToClipboard(payload);

    expect(result).toBe(false);
    expect(writeSpy).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      "[MarkQuote] Refusing to copy oversized clipboard payload",
      expect.objectContaining({ bytes: encoder.encode(payload).length }),
    );

    consoleSpy.mockRestore();
  });
});
