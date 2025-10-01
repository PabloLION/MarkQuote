import { describe, expect, it } from "vitest";
import { formatForClipboard } from "../../src/clipboard.js";
import { getSinonChrome } from "../../src/dev/chrome-dev-mock.js";

const sinonChrome = getSinonChrome();

describe("formatForClipboard", () => {
  it("should use the default format when none is in storage", async () => {
    const markdown = "# Hello, World!";
    const title = "My Page";
    const url = "https://example.com";
    const expected = `> # Hello, World!\n> Source: [My Page](https://example.com)`;

    const result = await formatForClipboard(markdown, title, url);
    expect(result).toBe(expected);
    expect(sinonChrome.storage.sync.get.calledOnce).toBe(true);
    expect(sinonChrome.storage.sync.get.firstCall.args[0]).toEqual(["options", "format"]);
  });

  it("should use the custom format from storage when it exists", async () => {
    const markdown = "Line 1\nLine 2";
    const title = "Another Page";
    const url = "https://example.org";
    const customFormat = `*Source: {{title}} ({{url}})*`;
    const expected = `> Line 1\n> Line 2\n*Source: Another Page (https://example.org)*`;

    await chrome.storage.sync.set({ format: customFormat });

    const result = await formatForClipboard(markdown, title, url);
    expect(result).toBe(expected);
  });
});
