import { afterEach, describe, expect, it } from "vitest";
import { clearValidationState, loadDom, markInvalidField } from "../../src/surfaces/options/dom.js";

function createOptionsDomElements() {
  document.body.innerHTML = `
    <form id="options-form"></form>
    <textarea id="format-template"></textarea>
    <button id="restore-template"></button>
    <pre id="format-preview"></pre>
    <div id="status"></div>
    <select id="title-sample-preset"></select>
    <select id="url-sample-preset"></select>
    <input id="sample-title" />
    <input id="sample-url" />
    <span id="sample-output-title"></span>
    <span id="sample-output-url"></span>
    <table><tbody id="title-rules-body"></tbody></table>
    <button id="add-title-rule"></button>
    <button id="clear-title-rules"></button>
    <button id="confirm-clear-title-rules"></button>
    <div id="title-clear-status"></div>
    <button id="save-title-rules"></button>
    <span id="title-unsaved-indicator"></span>
    <table><tbody id="url-rules-body"></tbody></table>
    <button id="add-url-rule"></button>
    <button id="clear-url-rules"></button>
    <button id="confirm-clear-url-rules"></button>
    <div id="url-clear-status"></div>
    <button id="save-url-rules"></button>
    <span id="url-unsaved-indicator"></span>
  `;
}

describe("options dom", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("returns null when required element missing", () => {
    document.body.innerHTML = "<div></div>";
    expect(() => loadDom()).toThrow();
  });

  it("loads DOM elements and clears validation", () => {
    createOptionsDomElements();
    const dom = loadDom();
    expect(dom).not.toBeNull();

    const input = document.createElement("input");
    input.setAttribute("aria-invalid", "true");
    const container = document.createElement("div");
    container.append(input);
    clearValidationState(container);
    expect(input.hasAttribute("aria-invalid")).toBe(false);

    markInvalidField(input);
    expect(input.getAttribute("aria-invalid")).toBe("true");
  });
});
