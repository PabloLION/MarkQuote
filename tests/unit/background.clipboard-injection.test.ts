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

  it("uses clipboard.writeText when available", async () => {
    const writeSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { clipboard: { writeText: writeSpy } },
    });
    document.execCommand = vi.fn();

    const result = await copySelectionToClipboard("example");

    expect(writeSpy).toHaveBeenCalledWith("example");
    expect(result).toBe(true);
    expect(document.execCommand).not.toHaveBeenCalled();
  });

  it("falls back to execCommand when clipboard API is unavailable", async () => {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {},
    });
    const execSpy = vi.fn().mockReturnValue(true);
    document.execCommand = execSpy as unknown as typeof document.execCommand;

    const result = await copySelectionToClipboard("fallback text");

    expect(execSpy).toHaveBeenCalledWith("copy");
    expect(result).toBe(true);
    expect(document.body.querySelector("textarea")).toBeNull();
  });

  it("returns false when execCommand fails", async () => {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {},
    });
    const execSpy = vi.fn().mockReturnValue(false);
    document.execCommand = execSpy as unknown as typeof document.execCommand;

    const result = await copySelectionToClipboard("failure");

    expect(result).toBe(false);
  });

  it("returns false when execCommand is unavailable", async () => {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {},
    });
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: undefined,
    });

    const result = await copySelectionToClipboard("fallback");

    expect(result).toBe(false);
    expect(document.body.querySelector("textarea")).toBeNull();
  });

  it("handles copy failures at the clipboard size limit", async () => {
    const writeSpy = vi.fn().mockRejectedValue(new Error("nope"));
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { clipboard: { writeText: writeSpy } },
    });
    const execSpy = vi.fn().mockReturnValue(false);
    document.execCommand = execSpy as unknown as typeof document.execCommand;

    const payload = "x".repeat(CLIPBOARD_MAX_BYTES);
    const result = await copySelectionToClipboard(payload);

    expect(writeSpy).toHaveBeenCalled();
    expect(execSpy).toHaveBeenCalledWith("copy");
    expect(result).toBe(false);
  });

  it("rejects clipboard writes that exceed the size limit", async () => {
    const writeSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { clipboard: { writeText: writeSpy } },
    });
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const oversized = "x".repeat(1_000_001);
    const result = await copySelectionToClipboard(oversized);

    expect(result).toBe(false);
    expect(writeSpy).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      "[MarkQuote] Refusing to copy oversized clipboard payload",
      expect.objectContaining({ bytes: oversized.length }),
    );

    consoleSpy.mockRestore();
  });

  it("measures byte length when enforcing the clipboard cap", async () => {
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

    const result = await copySelectionToClipboard(payload);

    expect(result).toBe(false);
    expect(writeSpy).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      "[MarkQuote] Refusing to copy oversized clipboard payload",
      expect.objectContaining({ bytes: encoder.encode(payload).length }),
    );

    consoleSpy.mockRestore();
  });
});
