/// <reference types="node" />

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSinonChrome } from "../../src/dev/chrome-dev-mock";
import {
  CURRENT_OPTIONS_VERSION,
  DEFAULT_AMAZON_SAMPLE_URL,
  DEFAULT_AMAZON_URL_PATTERN,
  DEFAULT_AMAZON_URL_REPLACE,
  DEFAULT_AMAZON_URL_SEARCH,
  DEFAULT_CHATGPT_UTM_TRAILING_REPLACE,
  DEFAULT_CHATGPT_UTM_TRAILING_SEARCH,
  DEFAULT_CHATGPT_UTM_URL_PATTERN,
  DEFAULT_CHATGPT_UTM_WITH_NEXT_REPLACE,
  DEFAULT_CHATGPT_UTM_WITH_NEXT_SEARCH,
  DEFAULT_WIKI_TITLE_REPLACE,
  DEFAULT_WIKI_TITLE_SEARCH,
  DEFAULT_WIKI_URL_PATTERN,
} from "../../src/options-schema";

const sinonChrome = getSinonChrome();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const html = fs.readFileSync(path.resolve(__dirname, "../../public/options.html"), "utf8");

function flushMicrotasks(): Promise<void> {
  return Promise.resolve();
}

describe("Options Page", () => {
  let disposeOptions: (() => void) | undefined;

  beforeEach(async () => {
    document.body.innerHTML = html;
    vi.resetModules();
    sinonChrome.reset();

    globalThis.chrome = sinonChrome as unknown as typeof chrome;

    sinonChrome.storage.sync.get.resolves({
      options: {
        version: 1,
        format: "> {{TEXT}}\n> Source: [{{TITLE}}]({{URL}})",
        titleRules: [],
        urlRules: [],
      },
    });
    sinonChrome.storage.sync.set.resolves();

    const { initializeOptions } = await import("../../src/surfaces/options/page");
    disposeOptions = initializeOptions();

    await flushMicrotasks();
    await flushMicrotasks();
  });

  afterEach(() => {
    disposeOptions?.();
    sinonChrome.reset();
  });

  it("initializes default wikipedia sample and title rule when storage is empty", async () => {
    disposeOptions?.();
    sinonChrome.reset();
    vi.resetModules();

    sinonChrome.storage.sync.get.resolves({});

    const { initializeOptions } = await import("../../src/surfaces/options/page");
    disposeOptions = initializeOptions();

    await flushMicrotasks();
    await flushMicrotasks();

    const titleSamplePresetSelect = document.getElementById(
      "title-sample-preset",
    ) as HTMLSelectElement | null;
    const urlSamplePresetSelect = document.getElementById(
      "url-sample-preset",
    ) as HTMLSelectElement | null;
    const sampleTitleInput = document.getElementById("sample-title") as HTMLInputElement | null;
    const sampleUrlInput = document.getElementById("sample-url") as HTMLInputElement | null;
    const sampleOutputTitle = document.getElementById("sample-output-title");
    const sampleOutputUrl = document.getElementById("sample-output-url");

    expect(titleSamplePresetSelect?.value).toBe("wikipedia");
    expect(urlSamplePresetSelect?.value).toBe("amazon");
    expect(sampleTitleInput?.value).toBe("Markdown - Wikipedia");
    expect(sampleUrlInput?.value).toBe(DEFAULT_AMAZON_SAMPLE_URL);
    expect(sampleOutputTitle?.textContent).toBe("Markdown - Wikipedia");
    expect(sampleOutputUrl?.textContent).toBe("https://www.amazon.com/dp/B01KBIJ53I");

    const firstTitleRow = document.querySelector<HTMLTableRowElement>("#title-rules-body tr");
    const firstUrlRow = document.querySelector<HTMLTableRowElement>("#url-rules-body tr");

    if (!firstTitleRow || !firstUrlRow) {
      throw new Error("Expected default rule rows to be rendered.");
    }

    const titlePatternInput = firstTitleRow.querySelector<HTMLInputElement>(
      'input[data-field="urlPattern"]',
    );
    const titleSearchInput = firstTitleRow.querySelector<HTMLInputElement>(
      'input[data-field="titleSearch"]',
    );
    const titleReplaceInput = firstTitleRow.querySelector<HTMLInputElement>(
      'input[data-field="titleReplace"]',
    );
    const titleCommentInput = firstTitleRow.querySelector<HTMLInputElement>(
      'input[data-field="comment"]',
    );
    const titleEnabledToggle = firstTitleRow.querySelector<HTMLInputElement>(
      'input[data-field="enabled"]',
    );
    const titleContinueToggle = firstTitleRow.querySelector<HTMLInputElement>(
      'input[data-field="continueMatching"]',
    );

    expect(titlePatternInput?.value).toBe(DEFAULT_WIKI_URL_PATTERN);
    expect(titleSearchInput?.value).toBe(DEFAULT_WIKI_TITLE_SEARCH);
    expect(titleReplaceInput?.value).toBe(DEFAULT_WIKI_TITLE_REPLACE);
    expect(titleCommentInput?.value).toBe("Format wiki link");
    expect(titleEnabledToggle?.checked).toBe(true);
    expect(titleContinueToggle?.checked).toBe(true);

    const urlRows = Array.from(
      document.querySelectorAll<HTMLTableRowElement>("#url-rules-body tr"),
    );
    expect(urlRows).toHaveLength(3);

    const [withNextRow, trailingRow, amazonRow] = urlRows;

    function readRow(row: HTMLTableRowElement) {
      const pattern = row.querySelector<HTMLInputElement>('input[data-field="urlPattern"]')?.value;
      const search = row.querySelector<HTMLInputElement>('input[data-field="urlSearch"]')?.value;
      const replace = row.querySelector<HTMLInputElement>('input[data-field="urlReplace"]')?.value;
      const comment = row.querySelector<HTMLInputElement>('input[data-field="comment"]')?.value;
      const enabled = row.querySelector<HTMLInputElement>('input[data-field="enabled"]')?.checked;
      const breakAfter = row.querySelector<HTMLInputElement>(
        'input[data-field="continueMatching"]',
      )?.checked;
      return { pattern, search, replace, comment, breakAfter, enabled };
    }

    expect(readRow(withNextRow)).toEqual({
      pattern: DEFAULT_CHATGPT_UTM_URL_PATTERN,
      search: DEFAULT_CHATGPT_UTM_WITH_NEXT_SEARCH,
      replace: DEFAULT_CHATGPT_UTM_WITH_NEXT_REPLACE,
      comment: "Remove ChatGPT UTM",
      enabled: true,
      breakAfter: false,
    });

    expect(readRow(trailingRow)).toEqual({
      pattern: DEFAULT_CHATGPT_UTM_URL_PATTERN,
      search: DEFAULT_CHATGPT_UTM_TRAILING_SEARCH,
      replace: DEFAULT_CHATGPT_UTM_TRAILING_REPLACE,
      comment: "Remove ChatGPT UTM",
      enabled: true,
      breakAfter: false,
    });

    expect(readRow(amazonRow)).toEqual({
      pattern: DEFAULT_AMAZON_URL_PATTERN,
      search: DEFAULT_AMAZON_URL_SEARCH,
      replace: DEFAULT_AMAZON_URL_REPLACE,
      comment: "Canonical Amazon URL",
      enabled: true,
      breakAfter: true,
    });
  });

  it("renders a preview using the saved template value", () => {
    const templateField = document.getElementById("format-template");
    const previewElement = document.getElementById("format-preview");
    const titleSamplePresetSelect = document.getElementById(
      "title-sample-preset",
    ) as HTMLSelectElement | null;
    const urlSamplePresetSelect = document.getElementById(
      "url-sample-preset",
    ) as HTMLSelectElement | null;
    const sampleUrlInput = document.getElementById("sample-url") as HTMLInputElement | null;
    const sampleTitleInput = document.getElementById("sample-title") as HTMLInputElement | null;
    const sampleOutputTitle = document.getElementById("sample-output-title");
    const sampleOutputUrl = document.getElementById("sample-output-url");
    const titleClearStatus = document.getElementById("title-clear-status");

    expect(templateField).toBeNull();
    expect(previewElement?.textContent).toContain("Markdown - Wikipedia");
    expect(previewElement?.textContent).toContain("https://www.amazon.com/dp/B01KBIJ53I");
    expect(titleSamplePresetSelect?.value).toBe("wikipedia");
    expect(urlSamplePresetSelect?.value).toBe("amazon");
    expect(sampleUrlInput?.value).toBe(DEFAULT_AMAZON_SAMPLE_URL);
    expect(sampleTitleInput?.value).toBe("Markdown - Wikipedia");
    expect(sampleOutputTitle?.textContent).toBe("Markdown - Wikipedia");
    expect(sampleOutputUrl?.textContent).toBe("https://www.amazon.com/dp/B01KBIJ53I");
    expect(titleClearStatus?.hidden).toBe(true);
  });

  it("updates the preview when the sample inputs change", () => {
    const previewElement = document.getElementById("format-preview");
    const sampleUrlInput = document.getElementById("sample-url") as HTMLInputElement;
    const sampleTitleInput = document.getElementById("sample-title") as HTMLInputElement;
    const titleSamplePresetSelect = document.getElementById(
      "title-sample-preset",
    ) as HTMLSelectElement;
    const urlSamplePresetSelect = document.getElementById("url-sample-preset") as HTMLSelectElement;
    const sampleOutputTitle = document.getElementById("sample-output-title");
    const sampleOutputUrl = document.getElementById("sample-output-url");

    sampleUrlInput.value = "https://dev.to/example";
    sampleUrlInput.dispatchEvent(new Event("input", { bubbles: true }));
    sampleTitleInput.value = "Dev Example Post";
    sampleTitleInput.dispatchEvent(new Event("input", { bubbles: true }));

    expect(urlSamplePresetSelect.value).toBe("custom");
    expect(titleSamplePresetSelect.value).toBe("custom");
    expect(previewElement?.textContent).toContain("https://dev.to/example");
    expect(previewElement?.textContent).toContain("Dev Example Post");
    expect(sampleOutputUrl?.textContent).toBe("https://dev.to/example");

    const titlePresetOption =
      titleSamplePresetSelect.querySelector<HTMLOptionElement>('option[value="mdn"]');
    if (!titlePresetOption) {
      throw new Error("Expected MDN title preset to exist.");
    }

    titleSamplePresetSelect.value = "mdn";
    titleSamplePresetSelect.dispatchEvent(new Event("change", { bubbles: true }));

    expect(sampleTitleInput.value).toBe(titlePresetOption.dataset.title);
    expect(sampleUrlInput.value).toBe("https://dev.to/example");
    expect(urlSamplePresetSelect.value).toBe("custom");
    expect(titleSamplePresetSelect.value).toBe("mdn");
    expect(previewElement?.textContent).toContain("https://dev.to/example");
    expect(previewElement?.textContent).toContain(titlePresetOption.dataset.title ?? "");
    expect(sampleOutputTitle?.textContent).toBe(titlePresetOption.dataset.title ?? "");
    expect(sampleOutputUrl?.textContent).toBe("https://dev.to/example");

    const urlPresetOption = urlSamplePresetSelect.querySelector<HTMLOptionElement>(
      'option[value="daring-fireball"]',
    );
    if (!urlPresetOption) {
      throw new Error("Expected Daring Fireball URL preset to exist.");
    }

    urlSamplePresetSelect.value = "daring-fireball";
    urlSamplePresetSelect.dispatchEvent(new Event("change", { bubbles: true }));

    expect(sampleUrlInput.value).toBe(urlPresetOption.dataset.url);
    expect(sampleTitleInput.value).toBe(titlePresetOption.dataset.title);
    expect(titleSamplePresetSelect.value).toBe("mdn");
    expect(urlSamplePresetSelect.value).toBe("daring-fireball");
    expect(previewElement?.textContent).toContain(urlPresetOption.dataset.url ?? "");
    expect(previewElement?.textContent).toContain(titlePresetOption.dataset.title ?? "");
    expect(sampleOutputUrl?.textContent).toBe(urlPresetOption.dataset.url ?? "");
    expect(sampleOutputTitle?.textContent).toBe(titlePresetOption.dataset.title ?? "");
  });

  it("persists title and URL rules with versioned payload", async () => {
    const addTitleRuleButton = document.getElementById("add-title-rule") as HTMLButtonElement;
    const addUrlRuleButton = document.getElementById("add-url-rule") as HTMLButtonElement;
    addTitleRuleButton.click();
    addUrlRuleButton.click();

    const titleRows = Array.from(
      document.querySelectorAll<HTMLTableRowElement>("#title-rules-body tr"),
    );
    const titleLastRow = titleRows[titleRows.length - 1];
    const titleUrlInput = titleLastRow?.querySelector<HTMLInputElement>(
      'input[data-field="urlPattern"]',
    );
    const titleSearchInput = titleLastRow?.querySelector<HTMLInputElement>(
      'input[data-field="titleSearch"]',
    );
    const titleReplaceInput = titleLastRow?.querySelector<HTMLInputElement>(
      'input[data-field="titleReplace"]',
    );
    const titleContinueToggle = titleLastRow?.querySelector<HTMLInputElement>(
      'input[data-field="continueMatching"]',
    );

    const urlRows = Array.from(
      document.querySelectorAll<HTMLTableRowElement>("#url-rules-body tr"),
    );
    const urlLastRow = urlRows[urlRows.length - 1];
    const urlRuleUrlInput = urlLastRow?.querySelector<HTMLInputElement>(
      'input[data-field="urlPattern"]',
    );
    const urlSearchInput = urlLastRow?.querySelector<HTMLInputElement>(
      'input[data-field="urlSearch"]',
    );
    const urlReplaceInput = urlLastRow?.querySelector<HTMLInputElement>(
      'input[data-field="urlReplace"]',
    );
    const urlContinueToggle = urlLastRow?.querySelector<HTMLInputElement>(
      'input[data-field="continueMatching"]',
    );

    const form = document.getElementById("options-form") as HTMLFormElement;

    if (
      !titleUrlInput ||
      !titleSearchInput ||
      !titleReplaceInput ||
      !titleContinueToggle ||
      !urlRuleUrlInput ||
      !urlSearchInput ||
      !urlReplaceInput ||
      !urlContinueToggle ||
      !form
    ) {
      throw new Error("Expected inputs were not present.");
    }

    titleUrlInput.value = "example.com";
    titleSearchInput.value = "Example";
    titleReplaceInput.value = "Sample";
    if (!titleContinueToggle || !urlContinueToggle) {
      throw new Error("Expected continue toggles to exist.");
    }

    titleContinueToggle.checked = false;
    urlRuleUrlInput.value = "example.com";
    urlSearchInput.value = "http";
    urlReplaceInput.value = "https";
    urlContinueToggle.checked = false;

    titleUrlInput.dispatchEvent(new Event("input", { bubbles: true }));
    titleSearchInput.dispatchEvent(new Event("input", { bubbles: true }));
    titleReplaceInput.dispatchEvent(new Event("input", { bubbles: true }));
    titleContinueToggle.dispatchEvent(new Event("change", { bubbles: true }));
    urlRuleUrlInput.dispatchEvent(new Event("input", { bubbles: true }));
    urlSearchInput.dispatchEvent(new Event("input", { bubbles: true }));
    urlReplaceInput.dispatchEvent(new Event("input", { bubbles: true }));
    urlContinueToggle.dispatchEvent(new Event("change", { bubbles: true }));

    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flushMicrotasks();
    await flushMicrotasks();

    expect(sinonChrome.storage.sync.set.calledOnce).toBe(true);

    const [payload] = sinonChrome.storage.sync.set.firstCall.args as [
      {
        options: {
          version: number;
          format: string;
          titleRules: Array<{
            urlPattern: string;
            titleSearch: string;
            titleReplace: string;
            continueMatching: boolean;
            enabled: boolean;
          }>;
          urlRules: Array<{
            urlPattern: string;
            urlSearch: string;
            urlReplace: string;
            continueMatching: boolean;
            enabled: boolean;
          }>;
        };
        format: string;
        titleRules: Array<{
          urlPattern: string;
          titleSearch: string;
          titleReplace: string;
          comment: string;
          continueMatching: boolean;
          enabled: boolean;
        }>;
        urlRules: Array<{
          urlPattern: string;
          urlSearch: string;
          urlReplace: string;
          comment: string;
          continueMatching: boolean;
          enabled: boolean;
        }>;
      },
    ];

    expect(payload.options.version).toBe(CURRENT_OPTIONS_VERSION);
    expect(payload.options.titleRules).toHaveLength(2);

    const [defaultTitleRule, customTitleRule] = payload.options.titleRules;

    expect(defaultTitleRule).toEqual({
      urlPattern: DEFAULT_WIKI_URL_PATTERN,
      titleSearch: DEFAULT_WIKI_TITLE_SEARCH,
      titleReplace: DEFAULT_WIKI_TITLE_REPLACE,
      comment: "Format wiki link",
      continueMatching: false,
      enabled: true,
    });

    expect(customTitleRule).toEqual({
      urlPattern: "example.com",
      titleSearch: "Example",
      titleReplace: "Sample",
      comment: "",
      continueMatching: true,
      enabled: true,
    });

    const urlRulesPayload = payload.options.urlRules;

    expect(urlRulesPayload).toHaveLength(4);

    const [withNextRule, trailingRule, amazonRule, customRule] = urlRulesPayload;

    expect(withNextRule).toEqual({
      urlPattern: DEFAULT_CHATGPT_UTM_URL_PATTERN,
      urlSearch: DEFAULT_CHATGPT_UTM_WITH_NEXT_SEARCH,
      urlReplace: DEFAULT_CHATGPT_UTM_WITH_NEXT_REPLACE,
      comment: "Remove ChatGPT UTM",
      continueMatching: true,
      enabled: true,
    });

    expect(trailingRule).toEqual({
      urlPattern: DEFAULT_CHATGPT_UTM_URL_PATTERN,
      urlSearch: DEFAULT_CHATGPT_UTM_TRAILING_SEARCH,
      urlReplace: DEFAULT_CHATGPT_UTM_TRAILING_REPLACE,
      comment: "Remove ChatGPT UTM",
      continueMatching: true,
      enabled: true,
    });

    expect(amazonRule).toEqual({
      urlPattern: DEFAULT_AMAZON_URL_PATTERN,
      urlSearch: DEFAULT_AMAZON_URL_SEARCH,
      urlReplace: DEFAULT_AMAZON_URL_REPLACE,
      comment: "Canonical Amazon URL",
      continueMatching: false,
      enabled: true,
    });

    expect(customRule).toEqual({
      urlPattern: "example.com",
      urlSearch: "http",
      urlReplace: "https",
      comment: "",
      continueMatching: true,
      enabled: true,
    });

    expect(payload.titleRules).toEqual(payload.options.titleRules);
    expect(payload.urlRules).toEqual(payload.options.urlRules);
  });

  it("allows disabling a title rule without removing it", async () => {
    const titleEnabledToggle = document.querySelector<HTMLInputElement>(
      '#title-rules-body tr:first-child input[data-field="enabled"]',
    );
    const titleRow = titleEnabledToggle?.closest<HTMLTableRowElement>("tr");
    const saveTitleRulesButton = document.getElementById("save-title-rules") as HTMLButtonElement;

    if (!titleEnabledToggle || !titleRow) {
      throw new Error("Expected default title rule toggle to exist.");
    }

    expect(titleEnabledToggle.checked).toBe(true);
    expect(titleRow.classList.contains("rule-disabled")).toBe(false);

    titleEnabledToggle.checked = false;
    titleEnabledToggle.dispatchEvent(new Event("change", { bubbles: true }));

    expect(titleRow.classList.contains("rule-disabled")).toBe(true);
    expect(saveTitleRulesButton.disabled).toBe(false);

    saveTitleRulesButton.click();

    await flushMicrotasks();
    await flushMicrotasks();

    expect(sinonChrome.storage.sync.set.calledOnce).toBe(true);

    const [payload] = sinonChrome.storage.sync.set.firstCall.args as [
      {
        titleRules: Array<{ enabled: boolean }>;
        options: { titleRules: Array<{ enabled: boolean }> };
      },
    ];

    expect(payload.titleRules[0].enabled).toBe(false);
    expect(payload.options.titleRules[0].enabled).toBe(false);
  });

  it("requires confirmation before clearing title rules", () => {
    const addTitleRuleButton = document.getElementById("add-title-rule") as HTMLButtonElement;
    const clearButton = document.getElementById("clear-title-rules") as HTMLButtonElement;
    const confirmButton = document.getElementById("confirm-clear-title-rules") as HTMLButtonElement;
    const clearStatus = document.getElementById("title-clear-status") as HTMLParagraphElement;

    addTitleRuleButton.click();
    const urlInput = document.querySelector<HTMLInputElement>(
      '#title-rules-body input[data-field="urlPattern"]',
    );

    if (!urlInput) {
      throw new Error("Expected rule input to exist after adding rule.");
    }

    urlInput.value = "example";
    urlInput.dispatchEvent(new Event("input", { bubbles: true }));

    expect(clearButton.hidden).toBe(false);
    expect(confirmButton.hidden).toBe(true);
    expect(clearStatus.hidden).toBe(true);

    clearButton.click();
    expect(clearButton.hidden).toBe(true);
    expect(confirmButton.hidden).toBe(false);
    expect(document.querySelectorAll("#title-rules-body tr").length).toBe(2);
    expect(clearStatus.hidden).toBe(true);

    confirmButton.click();
    expect(clearButton.hidden).toBe(false);
    expect(confirmButton.hidden).toBe(true);
    expect(document.querySelectorAll("#title-rules-body tr").length).toBe(0);
    expect(clearStatus.hidden).toBe(false);
    expect(clearStatus.textContent).toBe("All title rules cleared.");
  });

  it("requires confirmation before clearing URL rules", () => {
    const addUrlRuleButton = document.getElementById("add-url-rule") as HTMLButtonElement;
    const clearButton = document.getElementById("clear-url-rules") as HTMLButtonElement;
    const confirmButton = document.getElementById("confirm-clear-url-rules") as HTMLButtonElement;
    const clearStatus = document.getElementById("url-clear-status") as HTMLParagraphElement;

    const initialRowCount = document.querySelectorAll("#url-rules-body tr").length;

    addUrlRuleButton.click();
    const urlInput = document.querySelector<HTMLInputElement>(
      '#url-rules-body input[data-field="urlPattern"]',
    );

    if (!urlInput) {
      throw new Error("Expected URL rule input to exist after adding rule.");
    }

    urlInput.value = "example";
    urlInput.dispatchEvent(new Event("input", { bubbles: true }));

    expect(clearButton.hidden).toBe(false);
    expect(confirmButton.hidden).toBe(true);
    expect(clearStatus.hidden).toBe(true);

    clearButton.click();
    expect(clearButton.hidden).toBe(true);
    expect(confirmButton.hidden).toBe(false);
    expect(document.querySelectorAll("#url-rules-body tr").length).toBe(initialRowCount + 1);
    expect(clearStatus.hidden).toBe(true);

    confirmButton.click();
    expect(clearButton.hidden).toBe(false);
    expect(confirmButton.hidden).toBe(true);
    expect(document.querySelectorAll("#url-rules-body tr").length).toBe(0);
    expect(clearStatus.hidden).toBe(false);
    expect(clearStatus.textContent).toBe("All URL rules cleared.");
  });

  it("shows transformed sample outputs when title rules match", () => {
    const addTitleRuleButton = document.getElementById("add-title-rule") as HTMLButtonElement;
    addTitleRuleButton.click();

    const titleUrlInput = document.querySelector<HTMLInputElement>(
      '#title-rules-body input[data-field="urlPattern"]',
    );
    const titleSearchInput = document.querySelector<HTMLInputElement>(
      '#title-rules-body input[data-field="titleSearch"]',
    );
    const titleReplaceInput = document.querySelector<HTMLInputElement>(
      '#title-rules-body input[data-field="titleReplace"]',
    );
    const sampleOutputTitle = document.getElementById("sample-output-title");

    if (!titleUrlInput || !titleSearchInput || !titleReplaceInput || !sampleOutputTitle) {
      throw new Error("Expected title rule inputs not found.");
    }

    titleUrlInput.value = "example";
    titleSearchInput.value = "Example";
    titleReplaceInput.value = "Sample";

    titleUrlInput.dispatchEvent(new Event("input", { bubbles: true }));
    titleSearchInput.dispatchEvent(new Event("input", { bubbles: true }));
    titleReplaceInput.dispatchEvent(new Event("input", { bubbles: true }));

    const sampleTitleInput = document.getElementById("sample-title") as HTMLInputElement;
    const sampleUrlInput = document.getElementById("sample-url") as HTMLInputElement;

    sampleTitleInput.value = "Example Domain";
    sampleTitleInput.dispatchEvent(new Event("input", { bubbles: true }));
    sampleUrlInput.value = "https://example.com/";
    sampleUrlInput.dispatchEvent(new Event("input", { bubbles: true }));

    expect(sampleOutputTitle.textContent).toBe("Sample Domain");
  });

  it("shows transformed sample URL when URL rules match", () => {
    const addUrlRuleButton = document.getElementById("add-url-rule") as HTMLButtonElement;
    addUrlRuleButton.click();

    const urlRuleUrlInput = document.querySelector<HTMLInputElement>(
      '#url-rules-body input[data-field="urlPattern"]',
    );
    const urlSearchInput = document.querySelector<HTMLInputElement>(
      '#url-rules-body input[data-field="urlSearch"]',
    );
    const urlReplaceInput = document.querySelector<HTMLInputElement>(
      '#url-rules-body input[data-field="urlReplace"]',
    );
    const sampleOutputUrl = document.getElementById("sample-output-url");

    if (!urlRuleUrlInput || !urlSearchInput || !urlReplaceInput || !sampleOutputUrl) {
      throw new Error("Expected URL rule inputs not found.");
    }

    urlRuleUrlInput.value = "example";
    urlSearchInput.value = "^http://";
    urlReplaceInput.value = "https://";

    urlRuleUrlInput.dispatchEvent(new Event("input", { bubbles: true }));
    urlSearchInput.dispatchEvent(new Event("input", { bubbles: true }));
    urlReplaceInput.dispatchEvent(new Event("input", { bubbles: true }));

    const sampleUrlInput = document.getElementById("sample-url") as HTMLInputElement;
    sampleUrlInput.value = "http://example.com/";
    sampleUrlInput.dispatchEvent(new Event("input", { bubbles: true }));

    expect(sampleOutputUrl.textContent).toBe("https://example.com/");
  });

  it("rejects invalid regex patterns and keeps existing state", async () => {
    const addTitleRuleButton = document.getElementById("add-title-rule") as HTMLButtonElement;
    addTitleRuleButton.click();

    const urlInput = document.querySelector<HTMLInputElement>(
      '#title-rules-body input[data-field="urlPattern"]',
    );
    const titleSearchInput = document.querySelector<HTMLInputElement>(
      '#title-rules-body input[data-field="titleSearch"]',
    );
    const form = document.getElementById("options-form") as HTMLFormElement;
    const status = document.getElementById("status");

    if (!urlInput || !titleSearchInput || !form || !status) {
      throw new Error("Expected inputs were not present.");
    }

    urlInput.value = "[[["; // invalid regex
    titleSearchInput.value = "Title";
    urlInput.dispatchEvent(new Event("input", { bubbles: true }));
    titleSearchInput.dispatchEvent(new Event("input", { bubbles: true }));

    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flushMicrotasks();
    await flushMicrotasks();

    expect(sinonChrome.storage.sync.set.called).toBe(false);
    expect(urlInput.getAttribute("aria-invalid")).toBe("true");
    expect(status.getAttribute("data-variant")).toBe("error");
    expect(status.textContent).toMatch(/invalid regex/i);
  });

  it("does not render the template editor controls", () => {
    expect(document.getElementById("format-template")).toBeNull();
    expect(document.getElementById("restore-template")).toBeNull();
  });
});
