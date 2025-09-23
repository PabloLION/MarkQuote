type TitleRule = {
  urlMatch: string;
  titleMatch: string;
  titleReplace: string;
};

function isTitleRule(value: unknown): value is TitleRule {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<TitleRule>;
  return (
    typeof candidate.urlMatch === 'string' &&
    typeof candidate.titleMatch === 'string' &&
    typeof candidate.titleReplace === 'string'
  );
}

export async function formatForClipboard(
  markdown: string,
  title: string,
  url: string,
): Promise<string> {
  const defaultFormat = `> Source: [{{title}}]({{url}})`;

  const data = await chrome.storage.sync.get(['format', 'titleRules']);
  const format = data.format || defaultFormat;
  const titleRules = Array.isArray(data.titleRules) ? data.titleRules.filter(isTitleRule) : [];

  let transformedTitle = title;

  // Apply title transformation rules
  titleRules.forEach((rule) => {
    try {
      const urlRegex = new RegExp(rule.urlMatch);
      if (urlRegex.test(url)) {
        const titleRegex = new RegExp(rule.titleMatch);
        transformedTitle = transformedTitle.replace(titleRegex, rule.titleReplace);
      }
    } catch (e) {
      console.error('Error applying title rule:', rule, e);
    }
  });

  const source = format.replace('{{title}}', transformedTitle).replace('{{url}}', url);

  const formattedMarkdown = markdown
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');
  return `${formattedMarkdown}\n${source}`;
}
