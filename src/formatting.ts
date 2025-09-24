import type { OptionsPayload, TitleRule, UrlRule } from './options-schema.js';

export interface TemplateTokens {
  text: string;
  title: string;
  url: string;
}

function safeApplyRegex(source: string, pattern: string, replacement: string): string {
  try {
    const regex = new RegExp(pattern);
    return source.replace(regex, replacement);
  } catch (error) {
    console.error('Failed to apply regex replacement.', { pattern, replacement, error });
    return source;
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

function applyTitleRule(rule: TitleRule, title: string, url: string): string {
  if (!matchesUrlPattern(rule.urlPattern, url)) {
    return title;
  }

  if (!rule.titleSearch) {
    return title;
  }

  return safeApplyRegex(title, rule.titleSearch, rule.titleReplace);
}

export function applyTitleRules(rules: TitleRule[], startingTitle: string, url: string): string {
  return rules.reduce((currentTitle, rule) => applyTitleRule(rule, currentTitle, url), startingTitle);
}

function applyUrlRule(rule: UrlRule, url: string): string {
  if (!matchesUrlPattern(rule.urlPattern, url)) {
    return url;
  }

  if (!rule.urlSearch) {
    return url;
  }

  return safeApplyRegex(url, rule.urlSearch, rule.urlReplace);
}

export function applyUrlRules(rules: UrlRule[], startingUrl: string): string {
  return rules.reduce((currentUrl, rule) => applyUrlRule(rule, currentUrl), startingUrl);
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

    return lines
      .map((line, index) => (index === 0 ? line : `${prefix}${line}`))
      .join('\n');
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
