export const CURRENT_OPTIONS_VERSION = 3;

export interface TitleRule {
  urlPattern: string;
  titleSearch: string;
  titleReplace: string;
  comment: string;
  continueMatching: boolean;
  enabled: boolean;
}

export interface UrlRule {
  urlPattern: string;
  urlSearch: string;
  urlReplace: string;
  comment: string;
  continueMatching: boolean;
  enabled: boolean;
}

export interface OptionsPayload {
  version: number;
  format: string;
  titleRules: TitleRule[];
  urlRules: UrlRule[];
}

function isTitleRuleCandidate(value: unknown): value is TitleRule {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<TitleRule>;
  return (
    typeof candidate.urlPattern === "string" &&
    typeof candidate.titleSearch === "string" &&
    typeof candidate.titleReplace === "string" &&
    typeof candidate.comment === "string" &&
    typeof candidate.continueMatching === "boolean" &&
    typeof candidate.enabled === "boolean"
  );
}

function isUrlRuleCandidate(value: unknown): value is UrlRule {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<UrlRule>;
  return (
    typeof candidate.urlPattern === "string" &&
    typeof candidate.urlSearch === "string" &&
    typeof candidate.urlReplace === "string" &&
    typeof candidate.comment === "string" &&
    typeof candidate.continueMatching === "boolean" &&
    typeof candidate.enabled === "boolean"
  );
}

export const DEFAULT_TEMPLATE = "> {{TEXT}}\n> Source: [{{TITLE}}]({{URL}})";

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
  "https://www.amazon.com/Whenever-Need-Somebody-Astley-1987-08-02/dp/B01KBIJ53I/ref=sr_1_1?crid=AmazonSample123&dib=eyJ2IjoiMSJ9.rick.roll.sample&dib_tag=se&keywords=rick+astley+album&qid=1700000000&sprefix=rick+astley+album%2Caps%2C200&sr=8-1";

// biome-ignore lint/complexity/noUselessStringRaw: Keep raw template for regex sharing and documentation parity.
export const DEFAULT_CHATGPT_UTM_URL_PATTERN = String.raw`^https?://`;
export const DEFAULT_CHATGPT_UTM_WITH_NEXT_SEARCH = String.raw`([?&])utm_source=chatgpt\.com&`;
export const DEFAULT_CHATGPT_UTM_WITH_NEXT_REPLACE = "$1";
export const DEFAULT_CHATGPT_UTM_TRAILING_SEARCH = String.raw`([?&])utm_source=chatgpt\.com($|#)`;
export const DEFAULT_CHATGPT_UTM_TRAILING_REPLACE = "$2";

export const SAFE_REGEX_ALLOWLIST = new Set<string>([
  DEFAULT_WIKI_URL_PATTERN,
  DEFAULT_WIKI_TITLE_SEARCH,
  DEFAULT_CHATGPT_UTM_URL_PATTERN,
  DEFAULT_CHATGPT_UTM_WITH_NEXT_SEARCH,
  DEFAULT_CHATGPT_UTM_TRAILING_SEARCH,
  DEFAULT_AMAZON_URL_PATTERN,
  DEFAULT_AMAZON_URL_SEARCH,
]);

function sanitizeString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function sanitizeBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }
    if (normalized === "false") {
      return false;
    }
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  return false;
}

type StringFieldKey = string;

function readStringField(
  record: Record<string, unknown>,
  keys: StringFieldKey[] | StringFieldKey,
): string {
  const aliases = Array.isArray(keys) ? keys : [keys];
  for (const key of aliases) {
    if (Object.hasOwn(record, key) && record[key] !== undefined) {
      return sanitizeString(record[key]);
    }
  }
  return "";
}

function readBooleanField(
  record: Record<string, unknown>,
  keys: StringFieldKey[] | StringFieldKey,
): boolean {
  const aliases = Array.isArray(keys) ? keys : [keys];
  for (const key of aliases) {
    if (Object.hasOwn(record, key) && record[key] !== undefined) {
      return sanitizeBoolean(record[key]);
    }
  }
  return false;
}

function readEnabledField(record: Record<string, unknown>): boolean {
  if (Object.hasOwn(record, "enabled")) {
    return sanitizeBoolean(record.enabled);
  }

  if (Object.hasOwn(record, "disabled")) {
    return !sanitizeBoolean(record.disabled);
  }

  return true;
}

type RuleNormalizer<TRule> = (rawRule: unknown) => TRule | undefined;

function normalizeRuleCollection<TRule>(
  rawRules: unknown,
  normalizer: RuleNormalizer<TRule>,
): TRule[] {
  if (!Array.isArray(rawRules)) {
    return [];
  }

  return rawRules.map((entry) => normalizer(entry)).filter((rule): rule is TRule => Boolean(rule));
}

export function createDefaultTitleRules(): TitleRule[] {
  return [
    {
      urlPattern: DEFAULT_WIKI_URL_PATTERN,
      titleSearch: DEFAULT_WIKI_TITLE_SEARCH,
      titleReplace: DEFAULT_WIKI_TITLE_REPLACE,
      comment: "Format wiki link",
      continueMatching: false,
      enabled: true,
    },
  ];
}

export function createDefaultUrlRules(): UrlRule[] {
  return [
    {
      urlPattern: DEFAULT_CHATGPT_UTM_URL_PATTERN,
      urlSearch: DEFAULT_CHATGPT_UTM_WITH_NEXT_SEARCH,
      urlReplace: DEFAULT_CHATGPT_UTM_WITH_NEXT_REPLACE,
      comment: "Remove ChatGPT UTM",
      continueMatching: true,
      enabled: true,
    },
    {
      urlPattern: DEFAULT_CHATGPT_UTM_URL_PATTERN,
      urlSearch: DEFAULT_CHATGPT_UTM_TRAILING_SEARCH,
      urlReplace: DEFAULT_CHATGPT_UTM_TRAILING_REPLACE,
      comment: "Remove ChatGPT UTM",
      continueMatching: true,
      enabled: true,
    },
    {
      urlPattern: DEFAULT_AMAZON_URL_PATTERN,
      urlSearch: DEFAULT_AMAZON_URL_SEARCH,
      urlReplace: DEFAULT_AMAZON_URL_REPLACE,
      comment: "Canonical Amazon URL",
      continueMatching: false,
      enabled: true,
    },
  ];
}

export const DEFAULT_OPTIONS: OptionsPayload = {
  version: CURRENT_OPTIONS_VERSION,
  format: DEFAULT_TEMPLATE,
  titleRules: createDefaultTitleRules(),
  urlRules: createDefaultUrlRules(),
};

export function validateOptionsPayload(payload: unknown): payload is OptionsPayload {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const candidate = payload as Partial<OptionsPayload>;
  if (
    typeof candidate.version !== "number" ||
    typeof candidate.format !== "string" ||
    !Array.isArray(candidate.titleRules) ||
    !Array.isArray(candidate.urlRules)
  ) {
    return false;
  }

  return (
    candidate.titleRules.every((rule) => isTitleRuleCandidate(rule)) &&
    candidate.urlRules.every((rule) => isUrlRuleCandidate(rule))
  );
}

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
  comment?: unknown;
  continueMatching?: unknown;
  continue?: unknown;
  fallthrough?: unknown;
  enabled?: unknown;
  disabled?: unknown;
}

interface RawUrlRuleShape {
  urlPattern?: unknown;
  urlSearch?: unknown;
  urlReplace?: unknown;
  comment?: unknown;
  continueMatching?: unknown;
  continue?: unknown;
  fallthrough?: unknown;
  enabled?: unknown;
  disabled?: unknown;
}

interface RawCombinedRuleShape extends RawTitleRuleShape, RawUrlRuleShape {}

function isObject(candidate: unknown): candidate is Record<string, unknown> {
  return typeof candidate === "object" && candidate !== null;
}

function normalizeTitleRule(rawRule: unknown): TitleRule | undefined {
  if (!isObject(rawRule)) {
    return undefined;
  }

  const candidate = rawRule as RawTitleRuleShape;
  const record = candidate as Record<string, unknown>;
  const urlPattern = readStringField(record, ["urlPattern", "urlMatch"]);
  const titleSearch = readStringField(record, ["titleSearch", "titleMatch"]);
  const titleReplace = readStringField(record, "titleReplace");
  const comment = readStringField(record, "comment");
  const continueMatching = readBooleanField(record, [
    "continueMatching",
    "continue",
    "fallthrough",
  ]);
  const enabled = readEnabledField(record);

  if (!urlPattern && !titleSearch && !titleReplace) {
    return undefined;
  }

  return {
    urlPattern,
    titleSearch,
    titleReplace,
    comment,
    continueMatching,
    enabled,
  };
}

function normalizeUrlRule(rawRule: unknown): UrlRule | undefined {
  if (!isObject(rawRule)) {
    return undefined;
  }

  const candidate = rawRule as RawUrlRuleShape;
  const record = candidate as Record<string, unknown>;
  const urlPattern = readStringField(record, "urlPattern");
  const urlSearch = readStringField(record, "urlSearch");
  const urlReplace = readStringField(record, "urlReplace");
  const comment = readStringField(record, "comment");
  const continueMatching = readBooleanField(record, [
    "continueMatching",
    "continue",
    "fallthrough",
  ]);
  const enabled = readEnabledField(record);

  if (!urlPattern && !urlSearch && !urlReplace) {
    return undefined;
  }

  return {
    urlPattern,
    urlSearch,
    urlReplace,
    comment,
    continueMatching,
    enabled,
  };
}

function normalizeTitleRules(rawRules: unknown): TitleRule[] {
  return normalizeRuleCollection(rawRules, normalizeTitleRule);
}

function normalizeUrlRules(rawRules: unknown): UrlRule[] {
  return normalizeRuleCollection(rawRules, normalizeUrlRule);
}

interface CombinedRule {
  urlPattern: string;
  titleSearch: string;
  titleReplace: string;
  urlSearch: string;
  urlReplace: string;
  comment: string;
  continueMatching: boolean;
  enabled: boolean;
}

function normalizeCombinedRule(rawRule: unknown): CombinedRule | undefined {
  if (!isObject(rawRule)) {
    return undefined;
  }

  const candidate = rawRule as RawCombinedRuleShape;
  const record = candidate as Record<string, unknown>;
  const urlPattern = readStringField(record, ["urlPattern", "urlMatch"]);
  const titleSearch = readStringField(record, ["titleSearch", "titleMatch"]);
  const titleReplace = readStringField(record, "titleReplace");
  const urlSearch = readStringField(record, "urlSearch");
  const urlReplace = readStringField(record, "urlReplace");
  const comment = readStringField(record, "comment");
  const continueMatching = readBooleanField(record, [
    "continueMatching",
    "continue",
    "fallthrough",
  ]);
  const enabled = readEnabledField(record);

  if (!urlPattern && !titleSearch && !urlSearch && !urlReplace) {
    return undefined;
  }

  return {
    urlPattern,
    titleSearch,
    titleReplace,
    urlSearch,
    urlReplace,
    comment,
    continueMatching,
    enabled,
  };
}

function normalizeCombinedRules(rawRules: unknown): CombinedRule[] {
  return normalizeRuleCollection(rawRules, normalizeCombinedRule);
}

function combinedRulesToTitleRules(rules: CombinedRule[]): TitleRule[] {
  return normalizeRuleCollection(rules, normalizeTitleRule);
}

function combinedRulesToUrlRules(rules: CombinedRule[]): UrlRule[] {
  return normalizeRuleCollection(rules, normalizeUrlRule);
}

function normalizeFormat(rawFormat: unknown, hadLegacyFormat: boolean): string {
  let format = sanitizeString(rawFormat);

  if (!format) {
    return DEFAULT_TEMPLATE;
  }

  format = format
    .replace(/\{\{\s*text\s*\}\}/gi, "{{TEXT}}")
    .replace(/\{\{\s*title\s*\}\}/gi, "{{TITLE}}")
    .replace(/\{\{\s*(link|url)\s*\}\}/gi, "{{URL}}");

  const hasTextToken = /\{\{\s*TEXT\s*\}\}/.test(format);
  if (!hasTextToken) {
    const prefix = hadLegacyFormat ? "> {{TEXT}}" : "{{TEXT}}";
    format = `${prefix}${format ? `\n${format}` : ""}`;
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
