import { describe, expect, it } from 'vitest';

import { applyTransformRules, formatWithOptions } from '../../src/formatting.js';
import { CURRENT_OPTIONS_VERSION, type OptionsPayload } from '../../src/options-schema.js';

describe('formatWithOptions', () => {
  it('applies title and link transforms when URL matches', () => {
    const options: OptionsPayload = {
      version: CURRENT_OPTIONS_VERSION,
      format: '> {{TEXT}}\n> Source: [{{TITLE}}]({{LINK}})',
      rules: [
        {
          urlPattern: 'example.com',
          titleSearch: 'Example',
          titleReplace: 'Sample',
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
      rules: [],
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
    const rules: OptionsPayload['rules'] = [
      {
        urlPattern: 'nytimes',
        titleSearch: 'Opinion',
        titleReplace: 'Column',
        linkSearch: 'http',
        linkReplace: 'https',
      },
    ];

    const transformed = applyTransformRules(rules, 'Opinion Piece', 'http://nytimes.com/story');
    expect(transformed.title).toBe('Column Piece');
    expect(transformed.link).toBe('https://nytimes.com/story');
  });
});
