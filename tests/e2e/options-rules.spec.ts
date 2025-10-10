import { expect, test } from "@playwright/test";
import {
  CURRENT_OPTIONS_VERSION,
  createDefaultTitleRules,
  createDefaultUrlRules,
  DEFAULT_TEMPLATE,
  type OptionsPayload,
} from "../../src/options-schema.js";
import { readLastFormatted, setOptionsPayload } from "./helpers/background-bridge.js";
import {
  getExtensionId,
  launchExtensionContext,
  openExtensionPage,
  openPopupPage,
} from "./helpers/extension.js";
import { selectElementText } from "./helpers/selection.js";

let activeCleanup: (() => Promise<void>) | undefined;

test.afterEach(async () => {
  if (activeCleanup) {
    const cleanup = activeCleanup;
    activeCleanup = undefined;
    await cleanup();
  }
});

test("options UI edits update popup preview", async () => {
  const { context, cleanup } = await launchExtensionContext();
  activeCleanup = cleanup;

  const extensionId = await getExtensionId(context);
  const controlPage = await openPopupPage(context, extensionId);

  const initialOptions: OptionsPayload = {
    version: CURRENT_OPTIONS_VERSION,
    format: DEFAULT_TEMPLATE,
    titleRules: [
      {
        urlPattern: ".*",
        titleSearch: "(.+)",
        titleReplace: "Original:$1",
        comment: "",
        continueMatching: false,
        enabled: true,
      },
    ],
    urlRules: [
      {
        urlPattern: ".*",
        urlSearch: "^(.+)$",
        urlReplace: "$1?initial=true",
        comment: "",
        continueMatching: false,
        enabled: true,
      },
    ],
  };

  await setOptionsPayload(controlPage, initialOptions);
  await controlPage.close();

  const optionsPage = await openExtensionPage(context, extensionId, "options.html");
  const titleReplaceInput = optionsPage.locator(
    '#title-rules-body tr:first-child input[data-field="titleReplace"]',
  );
  const urlReplaceInput = optionsPage.locator(
    '#url-rules-body tr:first-child input[data-field="urlReplace"]',
  );

  await expect(titleReplaceInput).toHaveValue("Original:$1");
  await expect(urlReplaceInput).toHaveValue("$1?initial=true");

  await titleReplaceInput.fill("Edited:$1");
  await urlReplaceInput.fill("$1?edited=true");

  await optionsPage.locator("#save-options").click();
  await expect(optionsPage.locator("#status")).toHaveText("Options saved successfully.");

  await context.route("https://example.com/path", async (route) => {
    const html = `<!DOCTYPE html>
      <html lang="en">
        <head><meta charset="utf-8" /><title>Sample Title</title></head>
        <body><p id="quote">Body text</p></body>
      </html>`;
    await route.fulfill({ contentType: "text/html", body: html });
  });

  const articlePage = await context.newPage();
  await articlePage.goto("https://example.com/path", { waitUntil: "domcontentloaded" });
  await selectElementText(articlePage, "#quote", { expectedText: "Body text" });
  await articlePage.bringToFront();

  const popupPage = await openPopupPage(context, extensionId);

  const expectedPreview = `> Body text\n> Source: [Edited:Sample Title](https://example.com/path?edited=true)`;

  await expect
    .poll(async () => (await readLastFormatted(popupPage)).formatted, {
      message: "Waiting for options-transformed preview.",
    })
    .toBe(expectedPreview);

  await articlePage.close();
  await popupPage.close();
  await optionsPage.close();
});

test("chained URL rules respect break versus continue", async () => {
  const { context, cleanup } = await launchExtensionContext();
  activeCleanup = cleanup;

  const extensionId = await getExtensionId(context);
  const controlPage = await openPopupPage(context, extensionId);

  const titleRules = createDefaultTitleRules().map((rule) => ({ ...rule }));
  const urlRules = createDefaultUrlRules().map((rule) => ({ ...rule }));

  const amazonRule = { ...urlRules[2], continueMatching: false };
  const augmentedUrlRules = [
    urlRules[0],
    urlRules[1],
    amazonRule,
    {
      urlPattern: "^https?://",
      urlSearch: "$",
      urlReplace: "&should-not-appear=true",
      comment: "",
      continueMatching: true,
      enabled: true,
    },
  ];

  const options: OptionsPayload = {
    version: CURRENT_OPTIONS_VERSION,
    format: "{{URL}}",
    titleRules,
    urlRules: augmentedUrlRules,
  };

  await setOptionsPayload(controlPage, options);
  await controlPage.close();

  await context.route("https://www.amazon.com/**", async (route) => {
    const html = `<!DOCTYPE html>
      <html lang="en">
        <head><meta charset="utf-8" /><title>Amazon Title</title></head>
        <body><p id="quote">Sample</p></body>
      </html>`;
    await route.fulfill({ contentType: "text/html", body: html });
  });

  await context.route("https://example.com/**", async (route) => {
    const html = `<!DOCTYPE html>
      <html lang="en">
        <head><meta charset="utf-8" /><title>Example Title</title></head>
        <body><p id="quote">Sample</p></body>
      </html>`;
    await route.fulfill({ contentType: "text/html", body: html });
  });

  const amazonUrl =
    "https://www.amazon.com/Whenever-Need-Somebody-Astley-1987-08-02/dp/B01KBIJ53I/ref=tracking?utm_source=chatgpt.com&tag=123";

  const articlePage = await context.newPage();
  await articlePage.goto(amazonUrl, { waitUntil: "domcontentloaded" });
  await selectElementText(articlePage, "#quote", { expectedText: "Sample" });
  await articlePage.bringToFront();

  let popupPage = await openPopupPage(context, extensionId);
  const expectedAmazon = "Sample\nhttps://www.amazon.com/dp/B01KBIJ53I";
  await expect
    .poll(async () => (await readLastFormatted(popupPage)).formatted, {
      message: "Waiting for Amazon URL transformation.",
    })
    .toBe(expectedAmazon);
  await popupPage.close();

  const exampleUrl = "https://example.com/article?utm_source=chatgpt.com&utm_medium=email";

  await articlePage.goto(exampleUrl, { waitUntil: "domcontentloaded" });
  await selectElementText(articlePage, "#quote", { expectedText: "Sample" });
  await articlePage.bringToFront();

  popupPage = await openPopupPage(context, extensionId);
  const expectedExample =
    "Sample\nhttps://example.com/article?utm_medium=email&should-not-appear=true";
  await expect
    .poll(async () => (await readLastFormatted(popupPage)).formatted, {
      message: "Waiting for example.com URL transformation.",
    })
    .toBe(expectedExample);

  await articlePage.close();
  await popupPage.close();
});
