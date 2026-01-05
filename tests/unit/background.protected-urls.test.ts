import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getProtectedPageType, isUrlProtected } from "../../src/background/protected-urls.js";

const originalChrome = globalThis.chrome;

describe("background/protected-urls", () => {
  beforeEach(() => {
    // Mock chrome.runtime.id for same-extension detection
    globalThis.chrome = {
      ...originalChrome,
      runtime: {
        ...originalChrome?.runtime,
        id: "test-extension-id",
      },
    } as typeof chrome;
  });

  afterEach(() => {
    globalThis.chrome = originalChrome;
  });
  it("flags known browser-internal URLs", () => {
    const protectedSamples = [
      "chrome://extensions/",
      "chrome-error://some-error",
      "chrome-untrusted://flags",
      "chrome-search://local",
      "edge://settings",
      "opera://about",
      "vivaldi://flags",
      "brave://rewards",
      "devtools://devtools/bundled/inspector.html",
      "about:config",
    ];

    protectedSamples.forEach((sample) => {
      expect(isUrlProtected(sample)).toBe(true);
    });
  });

  it("allows regular web pages", () => {
    expect(isUrlProtected("https://example.com")).toBe(false);
    expect(isUrlProtected("http://localhost:3000")).toBe(false);
    expect(isUrlProtected(undefined)).toBe(false);
  });

  describe("getProtectedPageType", () => {
    it("returns chrome-internal for Chrome URLs", () => {
      expect(getProtectedPageType("chrome://extensions")).toBe("chrome-internal");
      expect(getProtectedPageType("chrome-error://crash")).toBe("chrome-internal");
      expect(getProtectedPageType("chrome-untrusted://flags")).toBe("chrome-internal");
      expect(getProtectedPageType("chrome-search://local")).toBe("chrome-internal");
      expect(getProtectedPageType("devtools://devtools/bundled/inspector.html")).toBe(
        "chrome-internal",
      );
    });

    it("returns extension-page for other Chrome extension URLs", () => {
      expect(getProtectedPageType("chrome-extension://other-ext-id/popup.html")).toBe(
        "extension-page",
      );
    });

    it("returns same-extension-page for this extension's own URLs", () => {
      expect(getProtectedPageType("chrome-extension://test-extension-id/options.html")).toBe(
        "same-extension-page",
      );
      expect(getProtectedPageType("chrome-extension://test-extension-id/popup.html")).toBe(
        "same-extension-page",
      );
    });

    it("returns edge-internal for Edge URLs", () => {
      expect(getProtectedPageType("edge://settings")).toBe("edge-internal");
      expect(getProtectedPageType("edge://flags")).toBe("edge-internal");
    });

    it("returns firefox-internal for Firefox URLs", () => {
      expect(getProtectedPageType("about:config")).toBe("firefox-internal");
      expect(getProtectedPageType("about:addons")).toBe("firefox-internal");
      expect(getProtectedPageType("moz-extension://uuid/popup.html")).toBe("firefox-internal");
    });

    it("returns chrome-internal for other Chromium-based browser URLs", () => {
      expect(getProtectedPageType("opera://about")).toBe("chrome-internal");
      expect(getProtectedPageType("vivaldi://flags")).toBe("chrome-internal");
      expect(getProtectedPageType("brave://rewards")).toBe("chrome-internal");
    });

    it("returns file-protocol for file URLs", () => {
      expect(getProtectedPageType("file:///home/user/document.html")).toBe("file-protocol");
      expect(getProtectedPageType("file:///C:/Users/document.pdf")).toBe("file-protocol");
    });

    it("returns extension-page for generic extension URLs", () => {
      expect(getProtectedPageType("safari-extension://id/page.html")).toBe("extension-page");
    });

    it("returns null for regular web pages", () => {
      expect(getProtectedPageType("https://example.com")).toBe(null);
      expect(getProtectedPageType("http://localhost:3000")).toBe(null);
    });

    it("returns null for empty or undefined URLs", () => {
      expect(getProtectedPageType(undefined)).toBe(null);
      expect(getProtectedPageType(null)).toBe(null);
      expect(getProtectedPageType("")).toBe(null);
    });

    it("handles case-insensitive URLs", () => {
      expect(getProtectedPageType("CHROME://settings")).toBe("chrome-internal");
      expect(getProtectedPageType("FILE:///path")).toBe("file-protocol");
    });
  });
});
