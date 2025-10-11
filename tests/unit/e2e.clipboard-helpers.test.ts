import { describe, expect, it } from "vitest";
import { assertClipboardContainsNonce, mintClipboardNonce } from "../e2e/helpers/clipboard.js";

describe("tests/e2e/helpers/clipboard", () => {
  it("generates unique nonces per invocation", () => {
    const first = mintClipboardNonce("popup");
    const second = mintClipboardNonce("popup");

    expect(first).not.toBe(second);
    expect(first).toContain("markquote-popup-");
    expect(second).toContain("markquote-popup-");
  });

  it("asserts clipboard text includes nonce", () => {
    const nonce = mintClipboardNonce();
    const text = `Sample clipboard payload :: ${nonce}`;

    expect(() => assertClipboardContainsNonce(text, nonce)).not.toThrow();
    expect(() => assertClipboardContainsNonce("missing", nonce)).toThrow(
      /did not include expected nonce/,
    );
  });
});
