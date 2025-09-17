import { describe, it, expect } from 'vitest';
import { formatForClipboard } from '../../src/clipboard';

describe('formatForClipboard', () => {
  it('should format a single line of markdown', () => {
    const markdown = '# Hello, World!';
    const title = 'My Page';
    const url = 'https://example.com';
    const expected = `> # Hello, World!\n> Source: [My Page](https://example.com)`;
    expect(formatForClipboard(markdown, title, url)).toBe(expected);
  });

  it('should format multiple lines of markdown', () => {
    const markdown = 'Line 1\nLine 2';
    const title = 'Another Page';
    const url = 'https://example.org';
    const expected = `> Line 1\n> Line 2\n> Source: [Another Page](https://example.org)`;
    expect(formatForClipboard(markdown, title, url)).toBe(expected);
  });
});
