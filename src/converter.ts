import TurndownService from 'turndown';

export function convertHtmlToMarkdown(html: string): string {
  const turndownService = new TurndownService({ headingStyle: 'atx' });
  const markdown = turndownService.turndown(html);
  return markdown;
}
