import { spawn } from 'child_process';
import { chromium } from 'playwright';
import path from 'path';
import os from 'os';
import fs from 'fs';

const PORT = 8080;
const devServerPage = `http://localhost:${PORT}/dev-server-page.html`;
const pathToExtension = path.resolve(process.cwd(), 'dist');

async function launchDevBrowser() {
  // Start http-server in the background
  const serverProcess = spawn('npx', ['http-server', '.', '-p', PORT, '-s'], {
    cwd: path.resolve(process.cwd()),
    detached: true,
    stdio: 'ignore',
  });
  serverProcess.unref(); // Allow the Node.js process to exit independently of the server

  console.log(`HTTP server started on port ${PORT}`);

  // Wait a moment for the server to start
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log(`Path to extension: ${pathToExtension}`);

  // Create a temporary user data directory for the persistent context
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playwright_extension_'));
  console.log(`Using temporary user data directory: ${userDataDir}`);

  // Launch Playwright browser with extension loaded
  const browserContext = await chromium.launchPersistentContext(userDataDir,
    {
      headless: false,
      channel: 'chromium',
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
    }
  );

  // Get the extension ID dynamically
  let extensionId;
  let optionsPageUrl;

  try {
    // Wait for a service worker to be registered within the context
    const serviceWorker = await browserContext.waitForEvent('serviceworker', { timeout: 10000 });
    console.log(`Service worker detected: ${serviceWorker.url()}`);

    const url = serviceWorker.url();
    const urlParts = url.split('/');
    extensionId = urlParts[2]; // The ID is typically the third part of the service worker URL
    console.log(`Extracted Extension ID: ${extensionId}`);

    optionsPageUrl = `chrome-extension://${extensionId}/options.html`;
    console.log(`Attempting to navigate to: ${optionsPageUrl}`);

  } catch (error) {
    console.error('Error detecting service worker or extension ID:', error);
    console.warn('Could not determine extension ID automatically. Navigation to options page will likely fail.');
    // If service worker detection fails, try to find the extension ID from background pages (less reliable for MV3)
    const pages = browserContext.pages();
    for (const p of pages) {
      if (p.url().startsWith('chrome-extension://') && p.url().endsWith('/background.html')) {
        const urlParts = p.url().split('/');
        extensionId = urlParts[2];
        console.log(`Fallback: Extracted Extension ID from background page: ${extensionId}`);
        break;
      }
    }
    if (!extensionId) {
      extensionId = 'UNKNOWN_EXTENSION_ID';
    }
    optionsPageUrl = `chrome-extension://${extensionId}/options.html`;
  }

  if (!extensionId || extensionId === 'UNKNOWN_EXTENSION_ID') {
    console.error('Failed to determine extension ID. Cannot navigate to options page.');
    await browserContext.close();
    serverProcess.kill();
    return;
  }

  const page = await browserContext.newPage();

  // Navigate to the extension's options page
  await page.goto(optionsPageUrl);

  console.log(`Playwright browser launched with extension (ID: ${extensionId}) and navigated to options page.`);

  // Keep the Node.js process alive until the browser is closed manually
  browserContext.on('close', () => {
    console.log('Browser context closed. Stopping server.');
    serverProcess.kill(); // Kill the http-server process
    // Add a short delay before cleaning up the temporary user data directory
    setTimeout(() => {
      fs.rmSync(userDataDir, { recursive: true, force: true });
      console.log(`Cleaned up temporary user data directory: ${userDataDir}`);
    }, 500); // 500ms delay
  });
}

launchDevBrowser().catch(console.error);
