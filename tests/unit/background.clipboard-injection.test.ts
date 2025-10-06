import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { copySelectionToClipboard } from "../../src/background/clipboard-injection.js";

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
});
