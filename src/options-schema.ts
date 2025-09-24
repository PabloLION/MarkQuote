export const CURRENT_OPTIONS_VERSION = 1;

export interface TransformRule {
  urlPattern: string;
  titleSearch: string;
  titleReplace: string;
  linkSearch: string;
  linkReplace: string;
}

export interface OptionsPayload {
  version: number;
  format: string;
  rules: TransformRule[];
}

export const DEFAULT_TEMPLATE = '> {{TEXT}}\n> Source: [{{TITLE}}]({{LINK}})';

export const DEFAULT_OPTIONS: OptionsPayload = {
  version: CURRENT_OPTIONS_VERSION,
  format: DEFAULT_TEMPLATE,
  rules: [],
};

interface StoredOptionsSnapshot {
  options?: unknown;
  format?: unknown;
  titleRules?: unknown;
}

interface LegacyRuleShape {
  urlMatch?: unknown;
  titleMatch?: unknown;
  titleReplace?: unknown;
}

interface ExtendedRuleShape extends LegacyRuleShape {
  urlPattern?: unknown;
  titleSearch?: unknown;
  linkSearch?: unknown;
  linkReplace?: unknown;
}

function isObject(candidate: unknown): candidate is Record<string, unknown> {
  return typeof candidate === 'object' && candidate !== null;
}

function sanitizeString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function normalizeRule(rawRule: unknown): TransformRule | undefined {
  if (!isObject(rawRule)) {
    return undefined;
  }

  const rule = rawRule as ExtendedRuleShape;
  const urlPattern = sanitizeString(rule.urlPattern ?? rule.urlMatch);
  const titleSearch = sanitizeString(rule.titleSearch ?? rule.titleMatch);
  const titleReplace = sanitizeString(rule.titleReplace);
  const linkSearch = sanitizeString(rule.linkSearch);
  const linkReplace = sanitizeString(rule.linkReplace);

  if (!urlPattern && !titleSearch && !linkSearch) {
    return undefined;
  }

  return {
    urlPattern,
    titleSearch,
    titleReplace,
    linkSearch,
    linkReplace,
  };
}

function normalizeRules(rawRules: unknown): TransformRule[] {
  if (!Array.isArray(rawRules)) {
    return [];
  }

  return rawRules
    .map((entry) => normalizeRule(entry))
    .filter((rule): rule is TransformRule => Boolean(rule));
}

function normalizeFormat(rawFormat: unknown, hadLegacyFormat: boolean): string {
  let format = sanitizeString(rawFormat);

  if (!format) {
    return DEFAULT_TEMPLATE;
  }

  format = format
    .replaceAll('{{text}}', '{{TEXT}}')
    .replaceAll('{{title}}', '{{TITLE}}')
    .replaceAll('{{url}}', '{{LINK}}');

  const hasTextToken = /\{\{\s*TEXT\s*\}\}/.test(format);
  if (!hasTextToken) {
    const prefix = hadLegacyFormat ? '> {{TEXT}}' : '{{TEXT}}';
    format = `${prefix}${format ? `\n${format}` : ''}`;
  }

  return format;
}

interface OptionsLike {
  version?: unknown;
  format?: unknown;
  rules?: unknown;
}

function isOptionsLike(candidate: unknown): candidate is OptionsLike {
  return isObject(candidate);
}

export function normalizeStoredOptions(snapshot: StoredOptionsSnapshot): OptionsPayload {
  if (isOptionsLike(snapshot.options)) {
    const normalizedRules = normalizeRules(snapshot.options.rules);
    return {
      version: CURRENT_OPTIONS_VERSION,
      format: normalizeFormat(snapshot.options.format, false),
      rules: normalizedRules,
    };
  }

  const legacyRules = normalizeRules(snapshot.titleRules);
  const legacyFormat = normalizeFormat(snapshot.format, true);

  return {
    version: CURRENT_OPTIONS_VERSION,
    format: legacyFormat,
    rules: legacyRules,
  };
}
