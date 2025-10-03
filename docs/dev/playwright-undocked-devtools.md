# Playwright: Launch Chromium with Undocked DevTools

Use this snippet to guarantee Chrome DevTools opens in a detached window when launching Chromium through Playwright. We rely on exactly this setup inside `scripts/package/tools/chrome-assets`, so you can reuse it for other projects.

## 1. Seed the profile preferences

Before `chromium.launchPersistentContext`, create the `Default/Preferences` file inside the temporary profile and write:

```json
{
  "devtools": {
    "preferences": {
      "currentDockState": "\"undocked\"",
      "previousDockState": "\"undocked\"",
      "lastDockState": "\"undocked\"",
      "uiTheme": "\"dark\""
    }
  }
}
```

Chrome stores preference values as JSON strings, so the nested quotes (`\"undocked\"`) are intentional—copy them verbatim.

## 2. Launch Chromium with DevTools enabled

```ts
const wantsDevtools = true; // or a flag you pass in
await chromium.launchPersistentContext(userDataDir, {
  headless: false,
  devtools: wantsDevtools,
  viewport: null,
  args: [
    `--disable-extensions-except=${distDir}`,
    `--load-extension=${distDir}`,
    "--window-size=1280,800",
    "--disable-infobars",
    "--auto-open-devtools-for-tabs", // only when wantsDevtools
  ],
  ignoreDefaultArgs: ["--enable-automation"],
});
```

## 3. Toggle with keyboard, fallback to CDP

After navigation, force DevTools to detach via the standard shortcut and fall back to the CDP command if needed:

```ts
const shortcut = process.platform === "darwin" ? "Meta+Alt+I" : "Control+Shift+I";
try {
  await page.waitForTimeout(400);
  await page.keyboard.press(shortcut);
  await page.waitForTimeout(200);
} catch (shortcutError) {
  try {
    const session = await page.context().newCDPSession(page);
    await session.send("Page.openDevToolsWindow" as any);
  } catch (cdpError) {
    console.warn("Unable to toggle DevTools window", { shortcutError, cdpError });
  }
}
```

## Reference implementation

See `scripts/package/tools/chrome-assets/helper/extension.ts` for the production version that wires these steps together via the `devtoolsUndocked` option.
