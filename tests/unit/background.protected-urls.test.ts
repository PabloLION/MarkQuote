import { describe, expect, it } from "vitest";
import { isUrlProtected } from "../../src/background/protected-urls.js";

describe("background/protected-urls", () => {
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
});
