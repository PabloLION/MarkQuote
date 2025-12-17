import { describe, expect, it } from "vitest";
import { createMessageController } from "../../src/surfaces/popup/message.js";

function buildDom() {
  const message = document.createElement("div");
  const messageText = document.createElement("span");
  message.append(messageText);

  return {
    message,
    messageText,
    preview: document.createElement("div"),
    previewCode: null,
    optionsButton: null,
    hotkeysButton: null,
    feedbackButton: null,
    inlineModeButton: null,
    problemBadge: null,
    errorContainer: null,
    errorList: null,
    copyDetailsButton: null,
    reportErrorsButton: null,
    dismissErrorsButton: null,
  };
}

describe("popup message controller", () => {
  it("sets text, label, and variant", () => {
    const dom = buildDom();
    const controller = createMessageController(dom);

    controller.set("Copied!", { label: "Status", variant: "success" });

    expect(dom.messageText.textContent).toBe("Copied!");
    expect(dom.message.hasAttribute("hidden")).toBe(false);
    expect(dom.message.dataset.label).toBe("Status");
    expect(dom.message.dataset.variant).toBe("success");
  });

  it("clears message and hides element", () => {
    const dom = buildDom();
    const controller = createMessageController(dom);

    controller.set("Temporary message");
    controller.clear();

    expect(dom.messageText.textContent).toBe("");
    expect(dom.message.getAttribute("hidden")).toBe("true");
    expect(dom.message.dataset.label).toBeUndefined();
    expect(dom.message.dataset.variant).toBeUndefined();
  });
});
