import { compileRegex, describePattern } from "./lib/regex.js";
import type { OptionsPayload, TitleRule, UrlRule } from "./options-schema.js";

export interface TemplateTokens {
  text: string;
  title: string;
  url: string;
}

interface RuleApplicationResult {
  value: string;
  matched: boolean;
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
    // A blank search string represents a simple "rewrite the title whenever the URL matches"
    // rule. Treat it as a match so the calling loop can respect `continueMatching` semantics
    // without forcing the user to provide a redundant pattern.
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
    // Empty search values intentionally short-circuit: the caller wants to rewrite the URL based on
    // the pattern match alone, so we mark it as matched while preserving the original value.
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
