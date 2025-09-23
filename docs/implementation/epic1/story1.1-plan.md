# Story 1.1: Project Setup & Foundation - Implementation Plan

## Goal
To establish a complete project structure with core development dependencies, a basic Chrome extension manifest, and a working "Hello World" content script, along with a configured testing framework.

## Acceptance Criteria (Recap)
1.  A GitHub repository is created for the project. (Already done)
2.  A `manifest.json` file is created with the necessary permissions (`contextMenus`, `activeTab`) and basic extension details.
3.  A testing framework (Vitest) is installed and configured.
4.  A basic "Hello World" content script can be successfully loaded and run in Chrome as an unpacked extension.

## Atomic Commits Plan

### Commit 1: Initialize `package.json` and Install Core Dev Dependencies
*   **Purpose:** Set up the basic Node.js project and install essential development tools.
*   **Changes:**
    *   Create `package.json` with basic project info.
    *   Install `typescript` as a dev dependency.
    *   Install `vitest` as a dev dependency.
    *   Install `jsdom` (for Vitest DOM testing) as a dev dependency.
    *   Add basic `test` script to `package.json` (`"test": "vitest"`).
    *   Create `tsconfig.json` with standard TypeScript compiler options.
*   **Commit Message:** `feat(setup): Initialize project and install core dev dependencies`

### Commit 2: Create Basic Chrome Extension Structure
*   **Purpose:** Lay down the fundamental files required for a Chrome extension.
*   **Changes:**
    *   Create `public/manifest.json` with:
        *   `manifest_version: 3`
        *   `name`, `version`, `description`
        *   `permissions: ["contextMenus", "activeTab"]`
        *   `action: { default_popup: "options.html", default_icon: "icons/icon-48.png" }` (placeholder for options page)
        *   `icons` pointing to placeholder icons.
    *   Create `src/background.ts` (empty for now).
    *   Create `src/content.ts` (empty for now).
    *   Create `public/icons/` directory and add placeholder icon files (e.g., `icon-16.png`, `icon-48.png`, `icon-128.png`).
*   **Commit Message:** `feat(extension): Add basic Chrome extension manifest and structure`

### Commit 3: Implement "Hello World" Content Script
*   **Purpose:** Verify the extension's basic functionality by injecting a simple script into web pages.
*   **Changes:**
    *   Add `console.log('Hello from MarkQuote!');` to `src/content.ts`.
    *   Update `manifest.json` to include the content script:
        ```json
        "content_scripts": [
          {
            "matches": ["<all_urls>"],
            "js": ["dist/content.js"]
          }
        ]
        ```
    *   Add a `build:content` script to `package.json` to compile `src/content.ts` using `tsc` (`"build:content": "tsc src/content.ts --outDir dist"`).
*   **Commit Message:** `feat(content): Implement basic "Hello World" content script`

### Commit 4: Configure Vitest and Add First Test
*   **Purpose:** Ensure the testing framework is correctly set up and a basic test can run.
*   **Changes:**
    *   Create `vitest.config.ts` with basic configuration (e.g., `environment: 'jsdom'`).
    *   Create `tests/unit/example.test.ts` with a simple passing test (e.g., `expect(true).toBe(true)`).
*   **Commit Message:** `feat(testing): Configure Vitest and add example unit test`
