import { describe, expect, it } from 'vitest';

import { applyTitleRules, applyUrlRules, formatWithOptions } from '../../src/formatting.js';
import {
  CURRENT_OPTIONS_VERSION,
  type UrlRule,
  type OptionsPayload,
  type TitleRule,
} from '../../src/options-schema.js';

describe('formatWithOptions', () => {
  it('applies title and URL transforms when URL matches', () => {
    const options: OptionsPayload = {
      version: CURRENT_OPTIONS_VERSION,
      format: '> {{TEXT}}\n> Source: [{{TITLE}}]({{URL}})',
      titleRules: [
        {
          urlPattern: 'example.com',
          titleSearch: 'Example',
          titleReplace: 'Sample',
          continueMatching: false,
        },
      ],
      urlRules: [
        {
          urlPattern: 'example.com',
          urlSearch: 'http',
          urlReplace: 'https',
          continueMatching: false,
        },
      ],
    };

    const result = formatWithOptions(options, {
      text: 'Quote',
      title: 'Example Article',
      url: 'http://example.com',
    });

    expect(result).toContain('[Sample Article](https://example.com)');
  });

  it('preserves indentation for multiline text replacements', () => {
    const options: OptionsPayload = {
      version: CURRENT_OPTIONS_VERSION,
      format: '> {{TEXT}}\n> Source: [{{TITLE}}]({{URL}})',
      titleRules: [],
      urlRules: [],
    };

    const output = formatWithOptions(options, {
      text: 'First line\nSecond line',
      title: 'Article',
      url: 'https://example.com',
    });

    expect(output).toContain('> First line');
    expect(output).toContain('\n> Second line');
  });

  it('returns transformed title and URL independently of template', () => {
    const titleRules: TitleRule[] = [
      {
        urlPattern: 'nytimes',
        titleSearch: 'Opinion',
        titleReplace: 'Column',
        continueMatching: false,
      },
    ];

    const urlRules: UrlRule[] = [
      {
        urlPattern: 'nytimes',
        urlSearch: 'http',
        urlReplace: 'https',
        continueMatching: false,
      },
    ];

    const transformedTitle = applyTitleRules(titleRules, 'Opinion Piece', 'http://nytimes.com/story');
    const transformedUrl = applyUrlRules(urlRules, 'http://nytimes.com/story');
    expect(transformedTitle).toBe('Column Piece');
    expect(transformedUrl).toBe('https://nytimes.com/story');
  });

  it('stops applying subsequent title rules when continueMatching is false', () => {
    const rules: TitleRule[] = [
      {
        urlPattern: '',
        titleSearch: 'First',
        titleReplace: 'Second',
        continueMatching: false,
      },
      {
        urlPattern: '',
        titleSearch: 'Second',
        titleReplace: 'Third',
        continueMatching: true,
      },
    ];

    const result = applyTitleRules(rules, 'First Article', 'https://example.com');
    expect(result).toBe('Second Article');
  });

  it('continues applying URL rules when continueMatching is true', () => {
    const rules: UrlRule[] = [
      {
        urlPattern: '',
        urlSearch: '^http://',
        urlReplace: 'https://',
        continueMatching: true,
      },
      {
        urlPattern: '',
        urlSearch: 'example',
        urlReplace: 'sample',
        continueMatching: false,
      },
    ];

    const result = applyUrlRules(rules, 'http://example.com/article');
    expect(result).toBe('https://sample.com/article');
  });

  it('continues applying title rules when continueMatching is true', () => {
    const rules: TitleRule[] = [
      {
        urlPattern: '',
        titleSearch: 'First',
        titleReplace: 'Second',
        continueMatching: true,
      },
      {
        urlPattern: '',
        titleSearch: 'Second',
        titleReplace: 'Third',
        continueMatching: false,
      },
    ];

    const result = applyTitleRules(rules, 'First Article', 'https://example.com');
    expect(result).toBe('Third Article');
  });
});
