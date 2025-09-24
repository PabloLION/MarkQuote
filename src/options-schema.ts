export const CURRENT_OPTIONS_VERSION = 1;

export interface TitleRule {
  urlPattern: string;
  titleSearch: string;
  titleReplace: string;
}

export interface LinkRule {
  urlPattern: string;
  linkSearch: string;
  linkReplace: string;
}

export interface OptionsPayload {
  version: number;
  format: string;
  titleRules: TitleRule[];
  linkRules: LinkRule[];
}

export const DEFAULT_TEMPLATE = '> {{TEXT}}\n> Source: [{{TITLE}}]({{LINK}})';

export const DEFAULT_WIKI_URL_PATTERN = String.raw`^https?://(?:[\w-]+\.)?en\.wikipedia\.org/`;
export const DEFAULT_WIKI_TITLE_SEARCH = String.raw`^(.+?) - Wikipedia$`;
export const DEFAULT_WIKI_TITLE_REPLACE = String.raw`Wiki:$1`;

function sanitizeString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function createDefaultTitleRules(): TitleRule[] {
  return [
    {
      urlPattern: DEFAULT_WIKI_URL_PATTERN,
      titleSearch: DEFAULT_WIKI_TITLE_SEARCH,
      titleReplace: DEFAULT_WIKI_TITLE_REPLACE,
    },
  ];
}

export function createDefaultLinkRules(): LinkRule[] {
  return [];
}

export const DEFAULT_OPTIONS: OptionsPayload = {
  version: CURRENT_OPTIONS_VERSION,
  format: DEFAULT_TEMPLATE,
  titleRules: createDefaultTitleRules(),
  linkRules: createDefaultLinkRules(),
};

interface StoredOptionsSnapshot {
  options?: unknown;
  format?: unknown;
  titleRules?: unknown;
  linkRules?: unknown;
  rules?: unknown;
}

interface RawTitleRuleShape {
  urlPattern?: unknown;
  urlMatch?: unknown;
  titleSearch?: unknown;
  titleMatch?: unknown;
  titleReplace?: unknown;
}

interface RawLinkRuleShape {
  urlPattern?: unknown;
  linkSearch?: unknown;
  linkReplace?: unknown;
}

interface RawCombinedRuleShape extends RawTitleRuleShape, RawLinkRuleShape {}

function isObject(candidate: unknown): candidate is Record<string, unknown> {
  return typeof candidate === 'object' && candidate !== null;
}

function normalizeTitleRule(rawRule: unknown): TitleRule | undefined {
  if (!isObject(rawRule)) {
    return undefined;
  }

  const candidate = rawRule as RawTitleRuleShape;
  const urlPattern = sanitizeString(candidate.urlPattern ?? candidate.urlMatch);
  const titleSearch = sanitizeString(candidate.titleSearch ?? candidate.titleMatch);
  const titleReplace = sanitizeString(candidate.titleReplace);

  if (!urlPattern && !titleSearch && !titleReplace) {
    return undefined;
  }

  return {
    urlPattern,
    titleSearch,
    titleReplace,
  };
}

function normalizeLinkRule(rawRule: unknown): LinkRule | undefined {
  if (!isObject(rawRule)) {
    return undefined;
  }

  const candidate = rawRule as RawLinkRuleShape;
  const urlPattern = sanitizeString(candidate.urlPattern);
  const linkSearch = sanitizeString(candidate.linkSearch);
  const linkReplace = sanitizeString(candidate.linkReplace);

  if (!urlPattern && !linkSearch && !linkReplace) {
    return undefined;
  }

  return {
    urlPattern,
    linkSearch,
    linkReplace,
  };
}

function normalizeTitleRules(rawRules: unknown): TitleRule[] {
  if (!Array.isArray(rawRules)) {
    return [];
  }

  return rawRules
    .map((entry) => normalizeTitleRule(entry))
    .filter((rule): rule is TitleRule => Boolean(rule));
}

function normalizeLinkRules(rawRules: unknown): LinkRule[] {
  if (!Array.isArray(rawRules)) {
    return [];
  }

  return rawRules
    .map((entry) => normalizeLinkRule(entry))
    .filter((rule): rule is LinkRule => Boolean(rule));
}

interface CombinedRule {
  urlPattern: string;
  titleSearch: string;
  titleReplace: string;
  linkSearch: string;
  linkReplace: string;
}

function normalizeCombinedRule(rawRule: unknown): CombinedRule | undefined {
  if (!isObject(rawRule)) {
    return undefined;
  }

  const candidate = rawRule as RawCombinedRuleShape;
  const urlPattern = sanitizeString(candidate.urlPattern ?? candidate.urlMatch);
  const titleSearch = sanitizeString(candidate.titleSearch ?? candidate.titleMatch);
  const titleReplace = sanitizeString(candidate.titleReplace);
  const linkSearch = sanitizeString(candidate.linkSearch);
  const linkReplace = sanitizeString(candidate.linkReplace);

  if (!urlPattern && !titleSearch && !linkSearch && !linkReplace) {
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

function normalizeCombinedRules(rawRules: unknown): CombinedRule[] {
  if (!Array.isArray(rawRules)) {
    return [];
  }

  return rawRules
    .map((entry) => normalizeCombinedRule(entry))
    .filter((rule): rule is CombinedRule => Boolean(rule));
}

function combinedRulesToTitleRules(rules: CombinedRule[]): TitleRule[] {
  return rules
    .map((rule) => normalizeTitleRule(rule))
    .filter((rule): rule is TitleRule => Boolean(rule));
}

function combinedRulesToLinkRules(rules: CombinedRule[]): LinkRule[] {
  return rules
    .map((rule) => normalizeLinkRule(rule))
    .filter((rule): rule is LinkRule => Boolean(rule));
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
  titleRules?: unknown;
  linkRules?: unknown;
  rules?: unknown;
}

function isOptionsLike(candidate: unknown): candidate is OptionsLike {
  return isObject(candidate);
}

function ensureTitleRules(rules: TitleRule[]): TitleRule[] {
  return rules.length > 0 ? rules : createDefaultTitleRules();
}

function ensureLinkRules(rules: LinkRule[]): LinkRule[] {
  return rules.length > 0 ? rules : createDefaultLinkRules();
}

export function normalizeStoredOptions(snapshot: StoredOptionsSnapshot): OptionsPayload {
  if (isOptionsLike(snapshot.options)) {
    const directTitleRules = normalizeTitleRules(snapshot.options.titleRules);
    const directLinkRules = normalizeLinkRules(snapshot.options.linkRules);
    const combined = normalizeCombinedRules(snapshot.options.rules);

    const titleRules = ensureTitleRules(
      directTitleRules.length > 0 ? directTitleRules : combinedRulesToTitleRules(combined),
    );
    const linkRules = ensureLinkRules(
      directLinkRules.length > 0 ? directLinkRules : combinedRulesToLinkRules(combined),
    );

    return {
      version: CURRENT_OPTIONS_VERSION,
      format: normalizeFormat(snapshot.options.format, false),
      titleRules,
      linkRules,
    };
  }

  const legacyCombined = normalizeCombinedRules(snapshot.rules ?? snapshot.titleRules);
  const legacyTitleRules = combinedRulesToTitleRules(legacyCombined);
  const legacyLinkRules = combinedRulesToLinkRules(legacyCombined);
  const legacyFormat = normalizeFormat(snapshot.format, true);

  return {
    version: CURRENT_OPTIONS_VERSION,
    format: legacyFormat,
    titleRules: ensureTitleRules(legacyTitleRules),
    linkRules: ensureLinkRules(legacyLinkRules),
  };
}
