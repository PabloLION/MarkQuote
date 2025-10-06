import { describe, expect, it } from "vitest";

import { loadPopupDom } from "../../src/surfaces/popup/dom.js";

function mountRequiredDom(): void {
  document.body.innerHTML = `
    <div id="message"><span id="message-text"></span></div>
    <section id="preview"><code></code></section>
    <button id="options-button"></button>
    <button id="hotkeys-button"></button>
    <button id="feedback-button"></button>
    <button id="inline-mode-button"></button>
    <span id="problem-badge"></span>
    <section id="error-container"></section>
    <ul id="error-list"></ul>
    <button id="report-errors-button"></button>
    <button id="dismiss-errors-button"></button>
  `;
}

describe("popup dom loader", () => {
  it("loads required elements and optional references", () => {
    mountRequiredDom();
    const dom = loadPopupDom();
    expect(dom.message.id).toBe("message");
    expect(dom.messageText.id).toBe("message-text");
    expect(dom.preview.id).toBe("preview");
    expect(dom.previewCode).not.toBeNull();
    expect(dom.optionsButton?.id).toBe("options-button");
  });

  it("throws when a required element is missing", () => {
    document.body.innerHTML = `<section id="preview"></section>`;
    expect(() => loadPopupDom()).toThrowError(/missing required element/);
  });
});
