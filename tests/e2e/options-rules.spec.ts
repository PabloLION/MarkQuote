import { expect, test } from "@playwright/test";
import {
  CURRENT_OPTIONS_VERSION,
  createDefaultTitleRules,
  createDefaultUrlRules,
  DEFAULT_TEMPLATE,
  type OptionsPayload,
} from "../../src/options-schema.js";
import {
  readLastFormatted,
  sendSelectionMessage,
  setOptionsPayload,
} from "./helpers/background-bridge.js";
import {
  getExtensionId,
  launchExtensionContext,
  openExtensionPage,
  openPopupPage,
} from "./helpers/extension.js";

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

  const popupPage = await openPopupPage(context, extensionId);

  await sendSelectionMessage(popupPage, {
    markdown: "Body text",
    title: "Sample Title",
    url: "https://example.com/path",
  });

  const expectedPreview = `> Body text\n> Source: [Edited:Sample Title](https://example.com/path?edited=true)`;

  await expect(await readLastFormatted(popupPage)).toEqual({
    formatted: expectedPreview,
    error: undefined,
  });

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

  const popupPage = await openPopupPage(context, extensionId);

  const amazonUrl =
    "https://www.amazon.com/Whenever-Need-Somebody-Astley-1987-08-02/dp/B01KBIJ53I/ref=tracking?utm_source=chatgpt.com&tag=123";

  await sendSelectionMessage(popupPage, {
    markdown: "Sample",
    title: "Amazon Title",
    url: amazonUrl,
  });
  await popupPage.waitForTimeout(500);
  const expectedAmazon = "Sample\nhttps://www.amazon.com/dp/B01KBIJ53I";
  await expect
    .poll(async () => (await readLastFormatted(popupPage)).formatted)
    .toBe(expectedAmazon);

  const exampleUrl = "https://example.com/article?utm_source=chatgpt.com&utm_medium=email";

  await sendSelectionMessage(popupPage, {
    markdown: "Sample",
    title: "Example Title",
    url: exampleUrl,
  });
  await popupPage.waitForTimeout(500);
  const expectedExample =
    "Sample\nhttps://example.com/article?utm_medium=email&should-not-appear=true";
  await expect
    .poll(async () => (await readLastFormatted(popupPage)).formatted)
    .toBe(expectedExample);

  await popupPage.close();
});
