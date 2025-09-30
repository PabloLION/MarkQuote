# MarkQuote Frontend Architecture Document

## Change Log

| Date | Version | Description | Author |
| :--- | :--- | :--- | :--- |
| 2025-09-13 | 1.0 | Initial draft based on PRD. | Gemini |

## Template and Framework Selection

Per the Product Requirements Document (PRD), this project will be built from scratch without a starter template or a heavy frontend framework like React or Vue. The core extension will use vanilla JavaScript (ES6+), HTML, and CSS to ensure it is lightweight and performant.

This approach means all tooling for development, bundling (e.g., using a tool like `esbuild` or `webpack`), and configuration will need to be set up manually.

The PRD allows for the potential use of a lightweight library (such as Preact or Svelte) specifically for the UI of the options page, but this will not be used for the core extension runtime.

## Frontend Tech Stack

### Technology Stack Table

| Category | Technology | Purpose | Rationale |
| :--- | :--- | :--- | :--- |
| Language | TypeScript | Superset of JS | Provides type safety and better developer experience. |
| Framework | **Vanilla TypeScript** | All UI | The options page and all extension logic are built with plain TypeScript and standard browser APIs. |
| UI Library | None | N/A | No UI component libraries are currently in use. |
| State Management | `chrome.storage` | Options Persistence | Chrome's built-in storage is sufficient for storing user options. |
| Build Tool | Vite | Compilation & Bundling | `Vite` is used for the final build and by the Vitest test runner. |
| Styling | CSS | Native browser styling | Standard CSS files will be used. |
| Testing | Vitest / JSDOM | Unit & Integration | Vitest for its modern features, with JSDOM to simulate a browser environment. |

## Project Structure

```plaintext
/
├── public/                  # Static assets and manifest
│   ├── manifest.json
│   ├── options.html
│   └── icons/
├── src/                     # TypeScript source code
│   ├── background/          # Background service worker and helpers
│   │   ├── index.ts         # Entry point registered in the manifest
│   │   ├── constants.ts
│   │   ├── copy-pipeline.ts
│   │   └── ...
│   ├── content-scripts/
│   │   └── selection.ts     # Injected script that reads the active selection
│   ├── surfaces/            # UI surfaces for popup/options/etc.
│   │   ├── popup/
│   │   │   ├── controller.ts
│   │   │   └── entry.ts
│   │   └── options/
│   │       ├── controller.ts
│   │       └── entry.ts
│   ├── clipboard.ts         # Logic for formatting clipboard content
│   ├── converter.ts         # HTML to Markdown conversion logic
│   ├── formatting.ts        # Markdown template + rule application helpers
│   └── options-schema.ts    # Shared schema/types for persisted options
├── tests/                   # Test files
│   └── unit/
├── .gitignore
├── package.json             # Project dependencies and scripts
└── tsconfig.json            # TypeScript compiler configuration
```

## Component Standards

### Component Template

Since we are not using a frontend framework, our "components" will primarily be either plain TypeScript functions that manipulate the DOM or small, self-contained TypeScript classes/functions for the options page.

```typescript
// src/surfaces/options/components/MyComponent.ts

interface MyComponentProps {
  text: string;
  onClick: (event: MouseEvent) => void;
}

export function createMyComponent(props: MyComponentProps): HTMLElement {
  const container = document.createElement('div');
  container.className = 'my-component'; // Apply styling via CSS

  const paragraph = document.createElement('p');
  paragraph.textContent = props.text;
  container.appendChild(paragraph);

  const button = document.createElement('button');
  button.textContent = 'Click Me';
  button.addEventListener('click', props.onClick);
  container.appendChild(button);

  return container;
}

// Usage example in controller.ts:
// import { createMyComponent } from './components/MyComponent';
// const myElement = createMyComponent({
//   text: 'Hello from component!',
//   onClick: () => console.log('Button clicked!')
// });
// document.getElementById('app')?.appendChild(myElement);

```

For `shadcn-svelte` components, they will be copied into `src/surfaces/options/components/` and adapted to our vanilla TypeScript setup as necessary, following their own internal structure.

### Options Page Layout

- **Template Editor:** Multiline `<textarea>` bound to the markdown template (default `> {{TEXT}}\n> Source: [{{TITLE}}]({{URL}})`) with helper text explaining the three tokens (`{{TEXT}}`, `{{TITLE}}`, `{{URL}}`) and a “Restore default template” button.
- **Preview:** Read-only `<pre>` element showing the markdown source generated from sample text/title/URL after applying the current template and rule transforms.
- **Title Rules:** Inline-editable rows with columns for `URL Pattern`, `Title Search`, and `Title Replace`, plus a remove control. “Add title rule” appends a blank row; validation highlights empty or invalid regex fields per column.
- **URL Rules:** Inline-editable rows with columns for `URL Pattern`, `URL Search`, and `URL Replace`, plus a remove control and clear-all workflow. “Add URL rule” appends a blank row; validation ensures patterns are present before replacements.
- **Status Messaging:** A lightweight status paragraph communicates save success or validation errors without modal dialogs.

### Naming Conventions

*   **Files:** `kebab-case` for filenames (e.g., `my-component.ts`, `service-worker.ts`).
*   **TypeScript Functions/Variables:** `camelCase` (e.g., `createMyComponent`, `markdownConverter`).
*   **TypeScript Classes:** `PascalCase` (e.g., `ClipboardManager`).
*   **Interfaces/Types:** `PascalCase` (e.g., `MyComponentProps`, `MarkdownOptions`).
*   **CSS Classes:** `kebab-case` (e.g., `my-component`, `options-page`).
*   **Constants:** `SCREAMING_SNAKE_CASE` (e.g., `DEFAULT_FORMAT_STRING`).

## State Management

### Store Structure

Since a dedicated state management library is not required, our "store structure" will be minimal, focusing on utilities for interacting with `chrome.storage`.

```plaintext
src/
├── core/
│   └── storage.ts # Utilities for chrome.storage interactions
└── options/
    └── options.ts # Local component state and interaction with global storage
```

### State Management Template

Our global state will primarily reside in `chrome.storage.sync` (for user-specific options that sync across browsers) or `chrome.storage.local` (for local-only data). Here's a template for interacting with it:

```typescript
// src/core/storage.ts

interface TitleRule {
  urlPattern: string;
  titleSearch: string;
  titleReplace: string;
}

interface UrlRule {
  urlPattern: string;
  urlSearch: string;
  urlReplace: string;
}

interface AppOptions {
  version: number;
  format: string;
  titleRules: TitleRule[];
  urlRules: UrlRule[];
}

const DEFAULT_OPTIONS: AppOptions = {
  version: 1,
  format: '> {{TEXT}}\n> Source: [{{TITLE}}]({{URL}})',
  titleRules: [],
  urlRules: [],
};

export async function getOptions(): Promise<AppOptions> {
  const storedOptions = await chrome.storage.sync.get(DEFAULT_OPTIONS);
  return { ...DEFAULT_OPTIONS, ...storedOptions } as AppOptions;
}

export async function setOptions(newOptions: Partial<AppOptions>): Promise<void> {
  await chrome.storage.sync.set({ ...newOptions, version: DEFAULT_OPTIONS.version });
}

// Example usage:
// async function loadAndUseOptions() {
//   const options = await getOptions();
//   console.log('Current template:', options.format);
// }

// async function updateTemplate(format: string) {
//   await setOptions({ format });
// }
```

## API Integration

### Service Template

Since there are no external APIs to integrate with, a traditional "service template" for HTTP requests is not required. Interactions with Chrome APIs will be handled directly or encapsulated in small utility functions.

```typescript
// src/core/chrome-api-utils.ts

// Example utility for interacting with Chrome's clipboard API (if needed directly)
export async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    throw new Error('Clipboard write failed.');
  }
}

// Example for sending messages between extension parts
export async function sendMessageToBackground(message: any): Promise<any> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        return reject(chrome.runtime.lastError);
      }
      resolve(response);
    });
  });
}
```

### API Client Configuration

As there is no external HTTP client or backend API, this section is not applicable.

## Routing

### Route Configuration

Explicit client-side routing is not required for MarkQuote. The extension's user interface is limited to a single HTML page (`options.html`) which serves as the configuration interface.

Access to this "route" is managed by the Chrome browser itself:
*   Users can typically access the options page by right-clicking the extension's toolbar icon and selecting "Options" or by navigating through Chrome's extension management page.
*   There are no protected routes, lazy loading, or authentication guards needed, as the options page is a local, single-page interface.

## Styling Guidelines

### Styling Approach

For the core extension (background and content scripts), there is minimal to no UI, so explicit styling guidelines are not required. Any necessary styling will be minimal and directly applied.

For the options page, styling will be primarily handled by **`shadcn-svelte`**, which is built on **Tailwind CSS**. This means we will leverage Tailwind's utility-first classes and `shadcn-svelte`'s component styles. Custom CSS will be used only for very specific overrides or unique layouts not covered by Tailwind or `shadcn-svelte`.

### Global Theme Variables

A dedicated global theme system using CSS Custom Properties is not required. `shadcn-svelte` and Tailwind CSS provide their own theming and customization capabilities, which will be utilized for the options page.

## Testing Requirements

### Component Test Template

**Vanilla TypeScript Function Test Template:**

```typescript
// tests/unit/core/markdown.test.ts

import { describe, it, expect } from 'vitest';
import { convertHtmlToMarkdown } from '../../../src/core/markdown'; // Adjust path as needed

describe('convertHtmlToMarkdown', () => {
  it('should convert bold tags correctly', () => {
    expect(convertHtmlToMarkdown('<b>hello</b>')).toBe('**hello**');
    expect(convertHtmlToMarkdown('<strong>world</strong>')).toBe('**world**');
  });

  it('should convert italic tags correctly', () => {
    expect(convertHtmlToMarkdown('<i>test</i>')).toBe('*test*');
    expect(convertHtmlToMarkdown('<em>example</em>')).toBe('*example*');
  });

  it('should handle nested tags', () => {
    expect(convertHtmlToMarkdown('<b><i>nested</i></b>')).toBe('***nested***');
  });

  // Add more tests for lists, links, etc.
});
```

**Svelte Component Test Template (for Options Page):**

```typescript
// tests/unit/options/OptionsPage.test.ts

import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import OptionsPage from '../../../src/surfaces/options/OptionsPage.svelte'; // Adjust path as needed

describe('OptionsPage', () => {
  it('should render the custom format input', () => {
    render(SettingsPage);
    expect(screen.getByLabelText(/Custom Format/i)).toBeInTheDocument();
  });

  it('should update input value on user typing', async () => {
    render(SettingsPage);
    const input = screen.getByLabelText(/Custom Format/i);
    await fireEvent.input(input, { target: { value: 'New Format' } });
    expect(input.value).toBe('New Format');
  });

  it('should call save handler when save button is clicked', async () => {
    const mockSave = vi.fn();
    render(SettingsPage, { props: { onSave: mockSave } }); // Assuming onSave prop
    const saveButton = screen.getByRole('button', { name: /Save/i });
    await fireEvent.click(saveButton);
    expect(mockSave).toHaveBeenCalledTimes(1);
  });
});
```

### Testing Best Practices

1.  **Unit Tests**: Test individual functions and components in isolation.
2.  **Integration Tests**: Test the interaction between different modules (e.g., content script interacting with background script, markdown conversion with clipboard formatting).
3.  **E2E Tests**: Automated End-to-End tests (e.g., with Playwright) are deferred to a later epic but will be crucial for verifying full user flows.
4.  **Coverage Goals**: Aim for a high code coverage (e.g., 80%+) for core logic.
5.  **Test Structure**: Follow the Arrange-Act-Assert (AAA) pattern for clear test cases.
6.  **Mock External Dependencies**: Mock Chrome APIs and other external dependencies to ensure tests are fast and reliable.

## Environment Configuration

### Environment Configuration

For the current scope of the MarkQuote extension, explicit environment variables (e.g., API keys, database URLs) are generally not required at runtime.

Any configuration differences between development and production environments will primarily be managed through:
*   **`tsconfig.json`**: For TypeScript compiler options.
*   **`package.json` scripts**: For build commands that might include flags for different modes (e.g., `--watch` for development, `--prod` for production).
*   **`manifest.json`**: The extension manifest itself can have different versions or configuration options for development vs. production.

Should the project expand to include external services (e.g., analytics, a backend API), then a more formal environment variable management system (e.g., using a `.env` file and a build-time replacement mechanism) would be introduced.

## Frontend Developer Standards

### Critical Coding Rules

These rules are essential for maintaining code quality, preventing common errors, and ensuring consistency across the codebase.

*   **TypeScript Strictness:** Always enable strict mode in `tsconfig.json` and strive to eliminate `any` types. Use specific types and interfaces.
*   **Immutability:** Favor immutable data structures where possible, especially when dealing with state.
*   **Error Handling:** Implement robust error handling for all asynchronous operations and potential failure points. Log errors appropriately.
*   **Side Effects:** Be mindful of side effects in functions. Pure functions are preferred where applicable.
*   **DOM Manipulation:** For the options page, minimize direct DOM manipulation outside of Svelte components. For content scripts, ensure DOM manipulation is targeted and does not interfere with the host page.
*   **Chrome API Usage:** Always check `chrome.runtime.lastError` after Chrome API calls that might fail.
*   **Svelte Reactivity:** Understand and correctly apply Svelte's reactivity rules (`$:`, `export let`, `bind:`) to ensure UI updates as expected.

### Quick Reference

*   **Common Commands:**
    *   `tsc --watch`: Start TypeScript compiler in watch mode for development.
    *   `tsc`: Compile TypeScript to JavaScript for production build.
    *   `vitest`: Run unit and integration tests.
    *   `vitest --watch`: Run tests in watch mode.
*   **Key Import Patterns:**
    *   `import { someFunction } from './utils/some-module';` (Relative imports for project files)
    *   `import { getSettings } from '../core/storage';` (Relative imports for core utilities)
*   **File Naming Conventions:**
    *   `kebab-case` for filenames (e.g., `my-component.ts`, `service-worker.ts`).
*   **Project-Specific Patterns and Utilities:**
    *   **`chrome.storage`:** Use the `src/core/storage.ts` utilities for all global options persistence.
    *   **Markdown Conversion:** Utilize the integrated markdown conversion library (Story 1.2) for all HTML-to-markdown needs.

```
