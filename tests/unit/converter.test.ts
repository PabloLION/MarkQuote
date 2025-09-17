import { describe, it, expect } from 'vitest';
import { convertHtmlToMarkdown } from '../../src/converter';

describe('convertHtmlToMarkdown', () => {
  it('should convert a simple h1 tag', () => {
    const html = '<h1>Hello, World!</h1>';
    const expectedMarkdown = '# Hello, World!';
    expect(convertHtmlToMarkdown(html)).toBe(expectedMarkdown);
  });

  it('should convert a paragraph with bold text', () => {
    const html = '<p>This is a <strong>bold</strong> statement.</p>';
    const expectedMarkdown = 'This is a **bold** statement.';
    expect(convertHtmlToMarkdown(html)).toBe(expectedMarkdown);
  });

  it('should convert an unordered list', () => {
    const html = '<ul><li>First item</li><li>Second item</li></ul>';
    const expectedMarkdown = `*   First item
*   Second item`;
    expect(convertHtmlToMarkdown(html)).toBe(expectedMarkdown);
  });

  it('should convert an image tag', () => {
    const html = '<img src="https://example.com/image.png" alt="An example image">';
    const expectedMarkdown = '![An example image](https://example.com/image.png)';
    expect(convertHtmlToMarkdown(html)).toBe(expectedMarkdown);
  });
});
