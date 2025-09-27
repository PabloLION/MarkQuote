export async function injectPublicPageMarkup(
  path: string | URL,
  mount: HTMLElement,
): Promise<() => void> {
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(`Failed to load markup for ${path}: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const parser = new DOMParser();
  const parsed = parser.parseFromString(html, "text/html");

  const appendedElements: Element[] = [];

  Array.from(parsed.head.querySelectorAll("style")).forEach((styleEl) => {
    const clone = document.createElement("style");
    clone.textContent = styleEl.textContent;
    mount.appendChild(clone);
    appendedElements.push(clone);
  });

  Array.from(parsed.body.children).forEach((child) => {
    if (child.tagName.toLowerCase() === "script") {
      return;
    }
    const clone = child.cloneNode(true) as Element;
    mount.appendChild(clone);
    appendedElements.push(clone);
  });

  return () => {
    appendedElements.forEach((element) => {
      element.remove();
    });
  };
}
