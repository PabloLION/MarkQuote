import type { OptionsPayload, TitleRule, UrlRule } from './options-schema.js';

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
  try {
    const regex = new RegExp(pattern);
    const matched = regex.test(source);
    if (!matched) {
      return { value: source, matched: false };
    }

    const replaced = source.replace(new RegExp(pattern), replacement);
    return { value: replaced, matched: true };
  } catch (error) {
    console.error('Failed to apply regex replacement.', { pattern, replacement, error });
    return { value: source, matched: false };
  }
}

function matchesUrlPattern(pattern: string, url: string): boolean {
  if (!pattern) {
    return true;
  }

  try {
    return new RegExp(pattern).test(url);
  } catch (error) {
    console.error('Invalid URL pattern; skipping rule.', { pattern, error });
    return false;
  }
}

function applyTitleRule(rule: TitleRule, title: string, url: string): RuleApplicationResult {
  if (!matchesUrlPattern(rule.urlPattern, url)) {
    return { value: title, matched: false };
  }

  if (!rule.titleSearch) {
    return { value: title, matched: true };
  }

  return safeApplyRegex(title, rule.titleSearch, rule.titleReplace);
}

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
  if (!matchesUrlPattern(rule.urlPattern, url)) {
    return { value: url, matched: false };
  }

  if (!rule.urlSearch) {
    return { value: url, matched: true };
  }

  return safeApplyRegex(url, rule.urlSearch, rule.urlReplace);
}

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
  const pattern = new RegExp(`\\{\\{\\s*${token}\\s*\\}}`, 'g');
  return template.replace(pattern, (_match: string, offset: number) => {
    const lineStart = template.lastIndexOf('\n', offset);
    const prefix = template.slice(lineStart + 1, offset);
    const lines = replacement.split('\n');

    if (lines.length <= 1) {
      return replacement;
    }

    return lines.map((line, index) => (index === 0 ? line : `${prefix}${line}`)).join('\n');
  });
}

function replaceTokens(template: string, tokens: Record<string, string>): string {
  return Object.entries(tokens).reduce((accumulator, [token, value]) => {
    const updated = replaceToken(accumulator, token, value);
    return replaceToken(updated, token.toLowerCase(), value);
  }, template);
}

export function formatWithOptions(options: OptionsPayload, tokens: TemplateTokens): string {
  const title = applyTitleRules(options.titleRules, tokens.title, tokens.url);
  const url = applyUrlRules(options.urlRules, tokens.url);

  return replaceTokens(options.format, {
    TEXT: tokens.text,
    TITLE: title,
    URL: url,
  });
}
