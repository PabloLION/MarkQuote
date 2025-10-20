import clipboard from "clipboardy";
import { chromium } from "playwright";

async function main(): Promise<void> {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const origin = "https://example.com";
  await context.grantPermissions(["clipboard-write"], { origin });

  const page = await context.newPage();
  const originalClipboard = await clipboard.read().catch(() => "");

  try {
    await page.goto(`${origin}/`);

    const nonce = `clipboard-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const writeError = await page.evaluate(async (value) => {
      try {
        await navigator.clipboard.writeText(value);
        return undefined;
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
    }, nonce);

    if (writeError) {
      throw new Error(`navigator.clipboard.writeText failed: ${writeError}`);
    }

    const hostClipboard = await clipboard.read();
    if (!hostClipboard.includes(nonce)) {
      throw new Error("System clipboard did not contain the expected nonce.");
    }

    console.log(`Chrome clipboard check passed (nonce: ${nonce})`);
  } finally {
    await clipboard.write(originalClipboard);
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error("Chrome clipboard sanity check failed:", error);
  process.exit(1);
});
