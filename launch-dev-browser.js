import { spawn } from 'child_process';
import { chromium } from 'playwright';
import path from 'path';
import os from 'os';
import fs from 'fs';

// --- Configuration ---
const PATH_TO_EXTENSION = path.resolve(process.cwd(), 'dist');
const DEV_MODE_TOGGLE_SELECTOR = 'cr-toggle#devMode';
const EXTENSION_ITEM_SELECTOR = 'extensions-item-list extensions-item';

// --- Helper Functions ---

/**
 * Creates a temporary user data directory for Playwright.
 * @returns {string} The path to the user data directory.
 */
function createUserDataDir() {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playwright_extension_'));
    console.log(`Using temporary user data directory: ${userDataDir}`);
    return userDataDir;
}

/**
 * Launches a persistent browser context with the extension loaded.
 * @param {string} userDataDir - Path to the user data directory.
 * @returns {Promise<import('playwright').BrowserContext>} The browser context.
 */
async function launchBrowserWithExtension(userDataDir) {
    console.log(`Loading extension from: ${PATH_TO_EXTENSION}`);
    const browserContext = await chromium.launchPersistentContext(userDataDir, {
        headless: false,
        channel: 'chromium',
        args: [
            `--disable-extensions-except=${PATH_TO_EXTENSION}`,
            `--load-extension=${PATH_TO_EXTENSION}`,
        ],
    });
    return browserContext;
}

/**
 * Navigates to chrome://extensions, enables developer mode, and extracts the extension ID.
 * @param {import('playwright').BrowserContext} browserContext - The browser context.
 * @returns {Promise<string|null>} The extension ID, or null if not found.
 */
async function getExtensionId(browserContext) {
    const page = await browserContext.newPage();
    try {
        await page.goto('chrome://extensions');
        console.log('Navigated to chrome://extensions to get ID.');

        const devModeToggle = page.locator(DEV_MODE_TOGGLE_SELECTOR);
        await devModeToggle.waitFor({ state: 'visible', timeout: 5000 });

        if (await devModeToggle.getAttribute('aria-pressed') === 'false') {
            await devModeToggle.click();
            console.log('Developer mode enabled.');
            await page.waitForTimeout(1000); // Wait for UI to settle
        } else {
            console.log('Developer mode already enabled.');
        }

        const extensionCard = page.locator(EXTENSION_ITEM_SELECTOR);
        await extensionCard.waitFor({ state: 'visible', timeout: 10000 });
        const extensionId = await extensionCard.getAttribute('id');
        console.log(`Extracted Extension ID: ${extensionId}`);
        return extensionId;
    } catch (error) {
        console.error('Error getting extension ID from chrome://extensions:', error);
        return null;
    } finally {
        await page.close();
    }
}

/**
 * Opens the extension's options and popup pages and sets up listeners for graceful shutdown.
 * @param {object} params - The parameters object.
 * @param {import('playwright').BrowserContext} params.browserContext - The browser context.
 * @param {string} params.extensionId - The ID of the extension.
 * @param {string} params.userDataDir - Path to the user data directory.
 */
async function openExtensionPagesAndTrack({ browserContext, extensionId, userDataDir }) {
    let openPagesCount = 0;

    const pagesToOpen = [
        { name: 'Options', url: `chrome-extension://${extensionId}/options.html` },
        { name: 'Popup', url: `chrome-extension://${extensionId}/popup.html` },
    ];

    const handlePageClose = async () => {
        openPagesCount--;
        console.log(`A page was closed. Remaining open pages: ${openPagesCount}`);
        if (openPagesCount <= 0) {
            console.log('All extension pages closed. Shutting down...');
            await browserContext.close();
            setTimeout(() => {
                fs.rmSync(userDataDir, { recursive: true, force: true });
                console.log(`Cleaned up temporary user data directory: ${userDataDir}`);
            }, 500);
        }
    };

    for (const pageInfo of pagesToOpen) {
        const newPage = await browserContext.newPage();
        await newPage.goto(pageInfo.url);
        console.log(`Launched ${pageInfo.name} Page.`);
        openPagesCount++;
        newPage.on('close', handlePageClose);
    }

    console.log(`Successfully launched ${pagesToOpen.length} extension pages.`);
}


// --- Main Execution ---

async function main() {
    const userDataDir = createUserDataDir();
    const browserContext = await launchBrowserWithExtension(userDataDir);

    const extensionId = await getExtensionId(browserContext);

    if (!extensionId) {
        console.error('Failed to determine extension ID. Aborting.');
        await browserContext.close();
        fs.rmSync(userDataDir, { recursive: true, force: true });
        return;
    }

    await openExtensionPagesAndTrack({ browserContext, extensionId, userDataDir });
}

main().catch(error => {
    console.error('An unexpected error occurred:', error);
    process.exit(1);
});
