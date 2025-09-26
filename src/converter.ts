import TurndownService from "turndown";

export function convertHtmlToMarkdown(html: string): string {
  const turndownService = new TurndownService({ headingStyle: "atx" });

  turndownService.addRule("image", {
    filter: "img",
    replacement: (_content, node) => {
      const img = node as HTMLImageElement;
      const alt = img.alt || "";
      const src = img.src || "";
      return `![${alt}](${src})`;
    },
  });

  const markdown = turndownService.turndown(html);
  return markdown;
}
