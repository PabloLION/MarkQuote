export function formatForClipboard(markdown: string, title: string, url: string): string {
  const source = `> Source: [${title}](${url})`;
  const formattedMarkdown = markdown.split('\n').map(line => `> ${line}`).join('\n');
  return `${formattedMarkdown}\n${source}`;
}
