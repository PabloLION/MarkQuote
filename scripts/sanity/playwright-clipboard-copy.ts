import clipboard from "clipboardy";
import { chromium } from "playwright";

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const origin = "https://example.com";

  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin });

  const page = await context.newPage();
  const originalClipboard = await clipboard.read().catch(() => "");

  try {
    await page.goto(origin, { waitUntil: "domcontentloaded" });

    // Inject a textarea and listen for copy events.
    await page.evaluate(() => {
      const textarea = document.createElement("textarea");
      textarea.id = "test-area";
      textarea.style.position = "absolute";
      textarea.style.top = "50px";
      textarea.style.left = "50px";
      document.body.appendChild(textarea);
      textarea.focus();

      document.addEventListener("copy", async (event) => {
        event.preventDefault();
        const text = "playwright-clipboard-" + Date.now();
        // Store the marker so we can read it later.
        (window as unknown as { lastCopied?: string }).lastCopied = text;
        await navigator.clipboard.writeText(text);
      });
    });

    // Simulate user action: select the textarea, press Ctrl+C.
    await page.click("#test-area");
    await page.keyboard.type("dummy text");
    await page.keyboard.down("Control");
    await page.keyboard.press("KeyC");
    await page.keyboard.up("Control");

    // Read value back inside the page.
    const pageClipboard = await page.evaluate(async () => {
      const text = await navigator.clipboard.readText();
      return {
        pageRead: text,
        handlerStored: (window as unknown as { lastCopied?: string }).lastCopied ?? "",
      };
    });

    const hostClipboard = await clipboard.read();

    console.log("Page clipboard read:", pageClipboard.pageRead);
    console.log("Handler stored:", pageClipboard.handlerStored);
    console.log("Host clipboard read:", hostClipboard);
  } finally {
    await clipboard.write(originalClipboard).catch(() => {});
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error("Playwright clipboard copy check failed:", error);
  process.exit(1);
});
