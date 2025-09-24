import type { LinkRule, OptionsPayload, TitleRule } from './options-schema.js';

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

function matchesUrlPattern(pattern: string, link: string): boolean {
  if (!pattern) {
    return true;
  }

  try {
    return new RegExp(pattern).test(link);
  } catch (error) {
    console.error('Invalid URL pattern; skipping rule.', { pattern, error });
    return false;
  }
}

function applyTitleRule(rule: TitleRule, title: string, link: string): string {
  if (!matchesUrlPattern(rule.urlPattern, link)) {
    return title;
  }

  if (!rule.titleSearch) {
    return title;
  }

  return safeApplyRegex(title, rule.titleSearch, rule.titleReplace);
}

export function applyTitleRules(rules: TitleRule[], startingTitle: string, link: string): string {
  return rules.reduce((currentTitle, rule) => applyTitleRule(rule, currentTitle, link), startingTitle);
}

function applyLinkRule(rule: LinkRule, link: string): string {
  if (!matchesUrlPattern(rule.urlPattern, link)) {
    return link;
  }

  if (!rule.linkSearch) {
    return link;
  }

  return safeApplyRegex(link, rule.linkSearch, rule.linkReplace);
}

export function applyLinkRules(rules: LinkRule[], startingLink: string): string {
  return rules.reduce((currentLink, rule) => applyLinkRule(rule, currentLink), startingLink);
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
  const title = applyTitleRules(options.titleRules, tokens.title, tokens.link);
  const link = applyLinkRules(options.linkRules, tokens.link);

  return replaceTokens(options.format, {
    TEXT: tokens.text,
    TITLE: title,
    LINK: link,
  });
}
