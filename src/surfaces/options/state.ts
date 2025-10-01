import {
  CURRENT_OPTIONS_VERSION,
  DEFAULT_AMAZON_SAMPLE_URL,
  DEFAULT_OPTIONS,
  DEFAULT_TEMPLATE,
  type OptionsPayload,
  type TitleRule,
  type UrlRule,
} from "../../options-schema.js";

export { DEFAULT_TEMPLATE };
export const OPTIONS_VERSION = CURRENT_OPTIONS_VERSION;

export const DEFAULT_PREVIEW_SAMPLE = {
  text: "Markdown is a lightweight markup language for creating formatted text using a plain-text editor.",
  title: "Markdown - Wikipedia",
  url: DEFAULT_AMAZON_SAMPLE_URL,
};

export const STATUS_TIMEOUT_MS = 3000;

export type DraftOptions = OptionsPayload;

export function createDraft(): DraftOptions {
  return cloneOptions(DEFAULT_OPTIONS);
}

export function cloneTitleRule(rule: TitleRule): TitleRule {
  return { ...rule };
}

export function cloneUrlRule(rule: UrlRule): UrlRule {
  return { ...rule };
}

export function cloneOptions(options: OptionsPayload): OptionsPayload {
  return {
    version: CURRENT_OPTIONS_VERSION,
    format: options.format,
    titleRules: options.titleRules.map((rule) => cloneTitleRule(rule)),
    urlRules: options.urlRules.map((rule) => cloneUrlRule(rule)),
  };
}

export function sanitizeTitleRule(rule: TitleRule): TitleRule {
  return {
    urlPattern: rule.urlPattern.trim(),
    titleSearch: rule.titleSearch.trim(),
    titleReplace: rule.titleReplace,
    comment: rule.comment.trim(),
    continueMatching: Boolean(rule.continueMatching),
    enabled: rule.enabled === false ? false : true,
  };
}

export function sanitizeUrlRule(rule: UrlRule): UrlRule {
  return {
    urlPattern: rule.urlPattern.trim(),
    urlSearch: rule.urlSearch.trim(),
    urlReplace: rule.urlReplace,
    comment: rule.comment.trim(),
    continueMatching: Boolean(rule.continueMatching),
    enabled: rule.enabled === false ? false : true,
  };
}

export function validateRegex(pattern: string): boolean {
  if (!pattern) {
    return false;
  }

  try {
    new RegExp(pattern);
    return true;
  } catch (error) {
    console.error("Invalid regex pattern.", { pattern, error });
    return false;
  }
}

export function normalizeFormat(templateField: HTMLTextAreaElement | null, draft: DraftOptions) {
  return templateField?.value ?? draft.format ?? DEFAULT_TEMPLATE;
}
