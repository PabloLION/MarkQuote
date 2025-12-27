import { TIMEOUTS } from "../../lib/constants.js";
import { compileRegex, describePattern } from "../../lib/regex.js";
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

export const STATUS_TIMEOUT_MS = TIMEOUTS.STATUS_DISPLAY_MS;

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
    showConfirmationPopup: options.showConfirmationPopup,
    showSmokeBuildIndicator: options.showSmokeBuildIndicator,
  };
}

export function sanitizeTitleRule(rule: TitleRule): TitleRule {
  return {
    urlPattern: rule.urlPattern.trim(),
    titleSearch: rule.titleSearch.trim(),
    titleReplace: rule.titleReplace,
    comment: rule.comment.trim(),
    continueMatching: Boolean(rule.continueMatching),
    enabled: rule.enabled !== false,
  };
}

export function sanitizeUrlRule(rule: UrlRule): UrlRule {
  return {
    urlPattern: rule.urlPattern.trim(),
    urlSearch: rule.urlSearch.trim(),
    urlReplace: rule.urlReplace,
    comment: rule.comment.trim(),
    continueMatching: Boolean(rule.continueMatching),
    enabled: rule.enabled !== false,
  };
}

export function validateRegex(pattern: string): boolean {
  if (!pattern) {
    // Empty inputs are common while the user is editing; treat as "not yet valid" without logging.
    return false;
  }

  // `compileRegex` handles both the maximum length guard and the safety check; when it reports an
  // error we simply surface the failure and allow the caller to keep editing. Throwing here would
  // break the optimistic form UX, so we rely on the shared helper to capture diagnostics.
  return (
    compileRegex(pattern, (error) => {
      console.error("Invalid regex pattern.", { pattern: describePattern(pattern), error });
    }) !== undefined
  );
}

export function normalizeFormat(templateField: HTMLTextAreaElement | null, draft: DraftOptions) {
  /* v8 ignore next - test always provides templateField; fallback chain handles missing DOM or draft values */
  return templateField?.value ?? draft.format ?? DEFAULT_TEMPLATE;
}
