import type { OptionsPayload, TransformRule } from './options-schema.js';

export interface TemplateTokens {
  text: string;
  title: string;
  link: string;
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

function applyRule(rule: TransformRule, title: string, link: string): { title: string; link: string } {
  const pattern = rule.urlPattern;
  if (!pattern) {
    return { title, link };
  }

  let urlRegex: RegExp;
  try {
    urlRegex = new RegExp(pattern);
  } catch (error) {
    console.error('Invalid URL pattern; skipping rule.', { pattern, error });
    return { title, link };
  }

  if (!urlRegex.test(link)) {
    return { title, link };
  }

  const nextTitle = rule.titleSearch
    ? safeApplyRegex(title, rule.titleSearch, rule.titleReplace)
    : title;

  const nextLink = rule.linkSearch ? safeApplyRegex(link, rule.linkSearch, rule.linkReplace) : link;

  return { title: nextTitle, link: nextLink };
}

function applyRules(rules: TransformRule[], startingTitle: string, startingLink: string): {
  title: string;
  link: string;
} {
  return rules.reduce(
    (accumulator, rule) => applyRule(rule, accumulator.title, accumulator.link),
    { title: startingTitle, link: startingLink },
  );
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
  const { title, link } = applyRules(options.rules, tokens.title, tokens.link);

  return replaceTokens(options.format, {
    TEXT: tokens.text,
    TITLE: title,
    LINK: link,
  });
}
