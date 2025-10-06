import safeRegex from "safe-regex";
import {
  type OptionsPayload,
  SAFE_REGEX_ALLOWLIST,
  type TitleRule,
  type UrlRule,
} from "./options-schema.js";

export interface TemplateTokens {
  text: string;
  title: string;
  url: string;
}

interface RuleApplicationResult {
  value: string;
  matched: boolean;
}

const MAX_REGEX_PATTERN_LENGTH = 500;

function compileRegex(pattern: string, onError: (error: unknown) => void): RegExp | undefined {
  if (!pattern) {
    return undefined;
  }

  if (pattern.length > MAX_REGEX_PATTERN_LENGTH) {
    console.error("Regex pattern exceeds maximum length.", describePattern(pattern));
    return undefined;
  }

  try {
    if (!SAFE_REGEX_ALLOWLIST.has(pattern) && !safeRegex(pattern)) {
      console.error("Refusing to compile unsafe regular expression.", describePattern(pattern));
      return undefined;
    }
    return new RegExp(pattern);
  } catch (error) {
    onError(error);
    return undefined;
  }
}

function describePattern(pattern: string): { preview: string; length: number } {
  const trimmed = pattern.trim();
  const normalized = trimmed.replace(/\s+/g, " ");
  const preview = normalized.length > 64 ? `${normalized.slice(0, 63)}…` : normalized;
  return {
    preview,
    length: pattern.length,
  };
}

function safeApplyRegex(
  source: string,
  pattern: string,
  replacement: string,
): RuleApplicationResult {
  const regex = compileRegex(pattern, (error) => {
    console.error("Failed to apply regex replacement.", {
      pattern: describePattern(pattern),
      replacement,
      error,
    });
  });

  if (!regex) {
    return { value: source, matched: false };
  }

  if (!regex.test(source)) {
    return { value: source, matched: false };
  }

  const replaced = source.replace(regex, replacement);
  return { value: replaced, matched: true };
}

function matchesUrlPattern(pattern: string, url: string): boolean {
  if (!pattern) {
    return true;
  }

  const regex = compileRegex(pattern, (error) => {
    console.error("Invalid URL pattern; skipping rule.", {
      pattern: describePattern(pattern),
      error,
    });
  });

  if (!regex) {
    return false;
  }

  return regex.test(url);
}

function applyTitleRule(rule: TitleRule, title: string, url: string): RuleApplicationResult {
  if (rule.enabled === false) {
    return { value: title, matched: false };
  }

  if (!matchesUrlPattern(rule.urlPattern, url)) {
    return { value: title, matched: false };
  }

  if (!rule.titleSearch) {
    return { value: title, matched: true };
  }

  return safeApplyRegex(title, rule.titleSearch, rule.titleReplace);
}

/**
 * Applies the provided title rules to the starting value, respecting `continueMatching` flags and
 * returning the transformed title.
 */
export function applyTitleRules(rules: TitleRule[], startingTitle: string, url: string): string {
  let currentTitle = startingTitle;

  for (const rule of rules) {
    const result = applyTitleRule(rule, currentTitle, url);
    currentTitle = result.value;

    if (result.matched && !rule.continueMatching) {
      break;
    }
  }

  return currentTitle;
}

function applyUrlRule(rule: UrlRule, url: string): RuleApplicationResult {
  if (rule.enabled === false) {
    return { value: url, matched: false };
  }

  if (!matchesUrlPattern(rule.urlPattern, url)) {
    return { value: url, matched: false };
  }

  if (!rule.urlSearch) {
    return { value: url, matched: true };
  }

  return safeApplyRegex(url, rule.urlSearch, rule.urlReplace);
}

/**
 * Runs URL rules against the captured link and returns the rewritten value. Rules short-circuit when
 * `continueMatching` is false.
 */
export function applyUrlRules(rules: UrlRule[], startingUrl: string): string {
  let currentUrl = startingUrl;

  for (const rule of rules) {
    const result = applyUrlRule(rule, currentUrl);
    currentUrl = result.value;

    if (result.matched && !rule.continueMatching) {
      break;
    }
  }

  return currentUrl;
}

function replaceToken(template: string, token: string, replacement: string): string {
  const pattern = new RegExp(`\\{\\{\\s*${token}\\s*\\}}`, "gi");
  return template.replace(pattern, (_match: string, offset: number) => {
    const lineStart = template.lastIndexOf("\n", offset);
    const prefix = template.slice(lineStart + 1, offset);
    const lines = replacement.split("\n");

    if (lines.length <= 1) {
      return replacement;
    }

    return lines.map((line, index) => (index === 0 ? line : `${prefix}${line}`)).join("\n");
  });
}

function replaceTokens(template: string, tokens: Record<string, string>): string {
  return Object.entries(tokens).reduce((accumulator, [token, value]) => {
    return replaceToken(accumulator, token, value);
  }, template);
}

/**
 * Formats clipboard output by applying title/URL rules and replacing template placeholders with the
 * supplied tokens.
 */
export function formatWithOptions(options: OptionsPayload, tokens: TemplateTokens): string {
  const title = applyTitleRules(options.titleRules, tokens.title, tokens.url);
  const url = applyUrlRules(options.urlRules, tokens.url);

  return replaceTokens(options.format, {
    TEXT: tokens.text,
    TITLE: title,
    URL: url,
  });
}
