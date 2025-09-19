export async function formatForClipboard(markdown: string, title: string, url: string): Promise<string> {
  const defaultFormat = `> Source: [{{title}}]({{url}})`;

  const data = await chrome.storage.sync.get('format');
  const format = data.format || defaultFormat;

  const source = format.replace('{{title}}', title).replace('{{url}}', url);

  const formattedMarkdown = markdown.split('\n').map(line => `> ${line}`).join('\n');
  return `${formattedMarkdown}\n${source}`;
}
