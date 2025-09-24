import { describe, expect, it } from 'vitest';

import { applyLinkRules, applyTitleRules, formatWithOptions } from '../../src/formatting.js';
import {
  CURRENT_OPTIONS_VERSION,
  type LinkRule,
  type OptionsPayload,
  type TitleRule,
} from '../../src/options-schema.js';

describe('formatWithOptions', () => {
  it('applies title and link transforms when URL matches', () => {
    const options: OptionsPayload = {
      version: CURRENT_OPTIONS_VERSION,
      format: '> {{TEXT}}\n> Source: [{{TITLE}}]({{LINK}})',
      titleRules: [
        {
          urlPattern: 'example.com',
          titleSearch: 'Example',
          titleReplace: 'Sample',
        },
      ],
      linkRules: [
        {
          urlPattern: 'example.com',
          linkSearch: 'http',
          linkReplace: 'https',
        },
      ],
    };

    const result = formatWithOptions(options, {
      text: 'Quote',
      title: 'Example Article',
      link: 'http://example.com',
    });

    expect(result).toContain('[Sample Article](https://example.com)');
  });

  it('preserves indentation for multiline text replacements', () => {
    const options: OptionsPayload = {
      version: CURRENT_OPTIONS_VERSION,
      format: '> {{TEXT}}\n> Source: [{{TITLE}}]({{LINK}})',
      titleRules: [],
      linkRules: [],
    };

    const output = formatWithOptions(options, {
      text: 'First line\nSecond line',
      title: 'Article',
      link: 'https://example.com',
    });

    expect(output).toContain('> First line');
    expect(output).toContain('\n> Second line');
  });

  it('returns transformed title and link independently of template', () => {
    const titleRules: TitleRule[] = [
      {
        urlPattern: 'nytimes',
        titleSearch: 'Opinion',
        titleReplace: 'Column',
      },
    ];

    const linkRules: LinkRule[] = [
      {
        urlPattern: 'nytimes',
        linkSearch: 'http',
        linkReplace: 'https',
      },
    ];

    const transformedTitle = applyTitleRules(titleRules, 'Opinion Piece', 'http://nytimes.com/story');
    const transformedLink = applyLinkRules(linkRules, 'http://nytimes.com/story');
    expect(transformedTitle).toBe('Column Piece');
    expect(transformedLink).toBe('https://nytimes.com/story');
  });
});
