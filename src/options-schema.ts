export const CURRENT_OPTIONS_VERSION = 1;

export interface TitleRule {
  urlPattern: string;
  titleSearch: string;
  titleReplace: string;
  continueMatching: boolean;
}

export interface UrlRule {
  urlPattern: string;
  urlSearch: string;
  urlReplace: string;
  continueMatching: boolean;
}

export interface OptionsPayload {
  version: number;
  format: string;
  titleRules: TitleRule[];
  urlRules: UrlRule[];
}

export const DEFAULT_TEMPLATE = '> {{TEXT}}\n> Source: [{{TITLE}}]({{URL}})';

export const DEFAULT_WIKI_URL_PATTERN = String.raw`^https?://(?:[\w-]+\.)?en\.wikipedia\.org/`;
// biome-ignore lint/complexity/noUselessStringRaw: Keep raw template for regex sharing and documentation parity.
export const DEFAULT_WIKI_TITLE_SEARCH = String.raw`^(.+?) - Wikipedia$`;
// biome-ignore lint/complexity/noUselessStringRaw: Keep raw template for regex sharing and documentation parity.
export const DEFAULT_WIKI_TITLE_REPLACE = String.raw`Wiki:$1`;

export const DEFAULT_AMAZON_URL_PATTERN = String.raw`^https?://(?:www\.)?amazon\.com/[^?]+/dp/([A-Z0-9]{10})`;
export const DEFAULT_AMAZON_URL_SEARCH = String.raw`^(https?://(?:www\.)?amazon\.com/)[^?]+/dp/([A-Z0-9]{10}).*`;
// biome-ignore lint/complexity/noUselessStringRaw: Keep raw template for regex sharing and documentation parity.
export const DEFAULT_AMAZON_URL_REPLACE = String.raw`$1dp/$2`;
export const DEFAULT_AMAZON_SAMPLE_URL =
  'https://www.amazon.com/Whenever-Need-Somebody-Astley-1987-08-02/dp/B01KBIJ53I/ref=sr_1_1?crid=AmazonSample123&dib=eyJ2IjoiMSJ9.rick.roll.sample&dib_tag=se&keywords=rick+astley+album&qid=1700000000&sprefix=rick+astley+album%2Caps%2C200&sr=8-1';

// biome-ignore lint/complexity/noUselessStringRaw: Keep raw template for regex sharing and documentation parity.
export const DEFAULT_CHATGPT_UTM_URL_PATTERN = String.raw`^https?://`;
export const DEFAULT_CHATGPT_UTM_WITH_NEXT_SEARCH = String.raw`([?&])utm_source=chatgpt\.com&`;
export const DEFAULT_CHATGPT_UTM_WITH_NEXT_REPLACE = '$1';
export const DEFAULT_CHATGPT_UTM_TRAILING_SEARCH = String.raw`([?&])utm_source=chatgpt\.com($|#)`;
export const DEFAULT_CHATGPT_UTM_TRAILING_REPLACE = '$2';

function sanitizeString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function sanitizeBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') {
      return true;
    }
    if (normalized === 'false') {
      return false;
    }
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  return false;
}

export function createDefaultTitleRules(): TitleRule[] {
  return [
    {
      urlPattern: DEFAULT_WIKI_URL_PATTERN,
      titleSearch: DEFAULT_WIKI_TITLE_SEARCH,
      titleReplace: DEFAULT_WIKI_TITLE_REPLACE,
      continueMatching: false,
    },
  ];
}

export function createDefaultUrlRules(): UrlRule[] {
  return [
    {
      urlPattern: DEFAULT_CHATGPT_UTM_URL_PATTERN,
      urlSearch: DEFAULT_CHATGPT_UTM_WITH_NEXT_SEARCH,
      urlReplace: DEFAULT_CHATGPT_UTM_WITH_NEXT_REPLACE,
      continueMatching: true,
    },
    {
      urlPattern: DEFAULT_CHATGPT_UTM_URL_PATTERN,
      urlSearch: DEFAULT_CHATGPT_UTM_TRAILING_SEARCH,
      urlReplace: DEFAULT_CHATGPT_UTM_TRAILING_REPLACE,
      continueMatching: true,
    },
    {
      urlPattern: DEFAULT_AMAZON_URL_PATTERN,
      urlSearch: DEFAULT_AMAZON_URL_SEARCH,
      urlReplace: DEFAULT_AMAZON_URL_REPLACE,
      continueMatching: false,
    },
  ];
}

export const DEFAULT_OPTIONS: OptionsPayload = {
  version: CURRENT_OPTIONS_VERSION,
  format: DEFAULT_TEMPLATE,
  titleRules: createDefaultTitleRules(),
  urlRules: createDefaultUrlRules(),
};

interface StoredOptionsSnapshot {
  options?: unknown;
  format?: unknown;
  titleRules?: unknown;
  linkRules?: unknown;
  urlRules?: unknown;
  rules?: unknown;
}

interface RawTitleRuleShape {
  urlPattern?: unknown;
  urlMatch?: unknown;
  titleSearch?: unknown;
  titleMatch?: unknown;
  titleReplace?: unknown;
  continueMatching?: unknown;
  continue?: unknown;
  fallthrough?: unknown;
}

interface RawUrlRuleShape {
  urlPattern?: unknown;
  urlSearch?: unknown;
  urlReplace?: unknown;
  continueMatching?: unknown;
  continue?: unknown;
  fallthrough?: unknown;
}

interface RawCombinedRuleShape extends RawTitleRuleShape, RawUrlRuleShape {}

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
  const continueMatching = sanitizeBoolean(
    candidate.continueMatching ?? candidate.continue ?? candidate.fallthrough,
  );

  if (!urlPattern && !titleSearch && !titleReplace) {
    return undefined;
  }

  return {
    urlPattern,
    titleSearch,
    titleReplace,
    continueMatching,
  };
}

function normalizeUrlRule(rawRule: unknown): UrlRule | undefined {
  if (!isObject(rawRule)) {
    return undefined;
  }

  const candidate = rawRule as RawUrlRuleShape;
  const urlPattern = sanitizeString(candidate.urlPattern);
  const urlSearch = sanitizeString(candidate.urlSearch);
  const urlReplace = sanitizeString(candidate.urlReplace);
  const continueMatching = sanitizeBoolean(
    candidate.continueMatching ?? candidate.continue ?? candidate.fallthrough,
  );

  if (!urlPattern && !urlSearch && !urlReplace) {
    return undefined;
  }

  return {
    urlPattern,
    urlSearch,
    urlReplace,
    continueMatching,
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

function normalizeUrlRules(rawRules: unknown): UrlRule[] {
  if (!Array.isArray(rawRules)) {
    return [];
  }

  return rawRules
    .map((entry) => normalizeUrlRule(entry))
    .filter((rule): rule is UrlRule => Boolean(rule));
}

interface CombinedRule {
  urlPattern: string;
  titleSearch: string;
  titleReplace: string;
  urlSearch: string;
  urlReplace: string;
  continueMatching: boolean;
}

function normalizeCombinedRule(rawRule: unknown): CombinedRule | undefined {
  if (!isObject(rawRule)) {
    return undefined;
  }

  const candidate = rawRule as RawCombinedRuleShape;
  const urlPattern = sanitizeString(candidate.urlPattern ?? candidate.urlMatch);
  const titleSearch = sanitizeString(candidate.titleSearch ?? candidate.titleMatch);
  const titleReplace = sanitizeString(candidate.titleReplace);
  const urlSearch = sanitizeString(candidate.urlSearch);
  const urlReplace = sanitizeString(candidate.urlReplace);
  const continueMatching = sanitizeBoolean(
    candidate.continueMatching ?? candidate.continue ?? candidate.fallthrough,
  );

  if (!urlPattern && !titleSearch && !urlSearch && !urlReplace) {
    return undefined;
  }

  return {
    urlPattern,
    titleSearch,
    titleReplace,
    urlSearch,
    urlReplace,
    continueMatching,
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

function combinedRulesToUrlRules(rules: CombinedRule[]): UrlRule[] {
  return rules
    .map((rule) => normalizeUrlRule(rule))
    .filter((rule): rule is UrlRule => Boolean(rule));
}

function normalizeFormat(rawFormat: unknown, hadLegacyFormat: boolean): string {
  let format = sanitizeString(rawFormat);

  if (!format) {
    return DEFAULT_TEMPLATE;
  }

  format = format
    .replace(/\{\{\s*text\s*\}\}/gi, '{{TEXT}}')
    .replace(/\{\{\s*title\s*\}\}/gi, '{{TITLE}}')
    .replace(/\{\{\s*(link|url)\s*\}\}/gi, '{{URL}}');

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
  urlRules?: unknown;
  rules?: unknown;
}

function isOptionsLike(candidate: unknown): candidate is OptionsLike {
  return isObject(candidate);
}

function ensureTitleRules(rules: TitleRule[]): TitleRule[] {
  return rules.length > 0 ? rules : createDefaultTitleRules();
}

function ensureUrlRules(rules: UrlRule[]): UrlRule[] {
  return rules.length > 0 ? rules : createDefaultUrlRules();
}

export function normalizeStoredOptions(snapshot: StoredOptionsSnapshot): OptionsPayload {
  if (isOptionsLike(snapshot.options)) {
    const directTitleRules = normalizeTitleRules(snapshot.options.titleRules);
    const directUrlRules = normalizeUrlRules(
      snapshot.options.urlRules ?? snapshot.options.linkRules,
    );
    const combined = normalizeCombinedRules(snapshot.options.rules);

    const titleRules = ensureTitleRules(
      directTitleRules.length > 0 ? directTitleRules : combinedRulesToTitleRules(combined),
    );
    const urlRules = ensureUrlRules(
      directUrlRules.length > 0 ? directUrlRules : combinedRulesToUrlRules(combined),
    );

    return {
      version: CURRENT_OPTIONS_VERSION,
      format: normalizeFormat(snapshot.options.format, false),
      titleRules,
      urlRules,
    };
  }

  const legacyUrlRules = normalizeUrlRules(snapshot.urlRules ?? snapshot.linkRules);
  const legacyTitleRules = normalizeTitleRules(snapshot.titleRules);
  const legacyCombined = normalizeCombinedRules(snapshot.rules);

  const resolvedTitleRules = ensureTitleRules(
    legacyTitleRules.length > 0 ? legacyTitleRules : combinedRulesToTitleRules(legacyCombined),
  );
  const resolvedUrlRules = ensureUrlRules(
    legacyUrlRules.length > 0 ? legacyUrlRules : combinedRulesToUrlRules(legacyCombined),
  );
  const legacyFormat = normalizeFormat(snapshot.format, true);

  return {
    version: CURRENT_OPTIONS_VERSION,
    format: legacyFormat,
    titleRules: resolvedTitleRules,
    urlRules: resolvedUrlRules,
  };
}
