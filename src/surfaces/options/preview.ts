import { applyTitleRules, applyUrlRules, formatWithOptions } from "../../formatting.js";
import type { TitleRule, UrlRule } from "../../options-schema.js";
import type { OptionsContext } from "./context.js";
import { DEFAULT_PREVIEW_SAMPLE, normalizeFormat, OPTIONS_VERSION } from "./state.js";

export interface PreviewRulesAdapter {
  filtered(scope: "title"): TitleRule[];
  filtered(scope: "url"): UrlRule[];
}

export function updatePreview(context: OptionsContext, rules: PreviewRulesAdapter): void {
  const { previewElement, sampleOutputTitle, sampleOutputUrl, templateField } = context.dom;

  const titleRules = rules.filtered("title");
  const urlRules = rules.filtered("url");

  const options = {
    version: OPTIONS_VERSION,
    format: normalizeFormat(templateField, context.draft),
    titleRules,
    urlRules,
    showConfirmationPopup: false,
  } as const;

  previewElement.textContent = formatWithOptions(options, {
    text: DEFAULT_PREVIEW_SAMPLE.text,
    title: context.previewSample.title,
    url: context.previewSample.url,
  });

  const transformedTitle = applyTitleRules(
    titleRules,
    context.previewSample.title,
    context.previewSample.url,
  );
  const transformedUrl = applyUrlRules(urlRules, context.previewSample.url);

  /* v8 ignore next 2 - transform functions always return strings in tests; fallback dash handles edge cases */
  sampleOutputTitle.textContent = transformedTitle || "—";
  sampleOutputUrl.textContent = transformedUrl || "—";
}

export function resetPreviewSample(context: OptionsContext): void {
  context.previewSample.title = DEFAULT_PREVIEW_SAMPLE.title;
  context.previewSample.url = DEFAULT_PREVIEW_SAMPLE.url;
}
