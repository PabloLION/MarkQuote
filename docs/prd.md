<!-- markdownlint-disable MD013 -->
# MarkQuote Product Requirements Document (PRD)

## Goals and Background Context

### Goals

- Deliver a highly efficient, intuitive tool for capturing web content into markdown.
- Provide a seamless, single-action workflow to replace the current manual, multi-step process.
- Ensure the core MVP functions (copy selection, context menu, rich text conversion) are performant and reliable.
- Establish a foundation for a successful open-source project that can be expanded upon by the community.

### Background Context

Currently, knowledge workers, developers, and students who use markdown for note-taking face a cumbersome process when referencing web content. They must manually select text, copy it, copy the URL, note the page title, and then combine and format all of these elements. This workflow is inefficient, repetitive, and disrupts their focus.

MarkQuote solves this problem by providing a lightweight Chrome extension that automates the entire process. By simply selecting text and using a context menu option, the user can copy the content perfectly formatted as a markdown blockquote that includes a source link with the page's title and URL. This provides a frictionless, "one-click" solution that integrates directly into their existing workflow.

### Change Log

| Date       | Version | Description                           | Author |
| :--------- | :------ | :------------------------------------ | :----- |
| 2025-09-13 | 1.0     | Initial draft based on Project Brief. | Gemini |

## Requirements

### Functional

1. **FR1: Copy Selection as Markdown with Reference:** The extension must allow the user to select text on a webpage and copy it to the clipboard as a markdown blockquote with an embedded markdown link to the source.
2. **FR2: Context Menu Integration:** The extension must add a new option to the browser's context menu (right-click menu) that triggers the copy action defined in FR1. This option should only appear when text is selected.
3. **FR3 (Updated): Toolbar Icon Action:** The extension must have a toolbar icon that, when clicked, performs the same action as the context menu: copying the currently selected text on the page using the format defined in FR1.
4. **FR4 (Updated): Default Keyboard Shortcut:** The extension must provide a default keyboard shortcut to trigger the copy action (FR1). The extension's help or options documentation should guide users to Chrome's native extensions page (`chrome://extensions/shortcuts`) to customize it.
5. **FR5: Rich Text to Markdown Conversion:** The extension must accurately convert common rich text formatting (e.g., bold, italics, lists, headers) within the selected text into their corresponding markdown syntax.
6. **FR6: Customizable Source URL Formatting:** The extension must provide an options page where users can define a markdown template for the copied output using the tokens `{{TEXT}}`, `{{TITLE}}`, and `{{URL}}`. Users must be able to configure regex-based search/replace rules for both title and URL values (per URL match), restore the default template, and view a live preview of the resulting markdown source while editing.

### Non-Functional

1. **NFR1: Performance:** The extension must perform the copy operation quickly, without noticeable lag or freezing of the browser tab.
2. **NFR2: Usability:** The user interface, including the context menu and any options surfaces, must be intuitive and easy to use for a non-technical audience.
3. **NFR3: Browser Compatibility:** The extension must be compatible with the latest version of Google Chrome.
4. **NFR4: Permissions:** The extension should request only the minimum necessary permissions to function correctly, such as `contextMenus` and `activeTab`.
5. **NFR5: Error Handling:** The extension must gracefully handle cases where no text is selected or where webpage data (like the title) is unavailable.
6. **NFR6: Open-Source:** The code for this extension should be open-source and publicly available on a platform like GitHub.

## User Interface Design Goals

### Overall UX Vision

The user experience should be minimalist, efficient, and nearly invisible. The extension's UI should not distract the user from their primary task of reading and writing. It should feel like a native browser feature that seamlessly enhances the user's workflow.

### Key Interaction Paradigms

- **Context-Aware Actions:** The primary interaction is through the right-click context menu, which appears only when text is selected, providing the tool exactly when and where it is needed.
- **Direct Action:** The toolbar icon provides a persistent, single-click entry point for the core functionality.
- **Simple Configuration:** A dedicated options page will let users adjust the markdown template, regex transforms, and preview the raw output without overwhelming them.

### Core Screens and Views

From a product perspective, the only required view is the **Options Page**. This page will host the configuration for the customizable source URL format (FR6). All other interactions are integrated directly into the browser's existing UI (context menu, toolbar).

### Accessibility: WCAG AA

The options page and any notifications should meet WCAG 2.1 AA standards to be accessible to a wide range of users.

### Branding

No specific branding guidelines have been provided. The UI should be clean, modern, and align with the standard Chrome browser aesthetic to feel native and trustworthy.

### Target Device and Platforms: Web Responsive

The extension will operate on web pages within the desktop Google Chrome browser. The options page should be responsive and work well across all typical desktop screen sizes.

## Technical Assumptions

### Repository Structure: Monorepo

The project will be contained within a single repository on GitHub, which will include the extension's source code, documentation, and any related assets.

### Service Architecture: Self-Contained Client-Side Architecture

The extension is a self-contained, client-side application that runs entirely in the user's browser. It does not have, and does not require, any backend components.

### Testing Requirements: Unit + Integration

The project should include a testing suite. Unit tests should cover individual JavaScript functions (e.g., the markdown conversion logic). Integration tests should use a browser automation framework (like Jest with Puppeteer) to simulate user actions (e.g., selecting text, right-clicking) and verify the final clipboard content is correct.

### Additional Technical Assumptions and Requests

- **Technology Stack:** The extension will be built with standard, lightweight web technologies: HTML, CSS, and modern JavaScript (ES6+). No heavy frontend frameworks will be used in the core, content-script part of the extension. For the options page UI, a lightweight library (e.g., Preact, Svelte) may be used to facilitate interactive previews, though the current plan favors vanilla TypeScript/HTML.
- **Data Versioning:** Persisted options data must include a schema version so future releases can migrate templates and rules without data loss.
- **Core APIs:** The implementation will rely on standard Chrome Extension APIs, specifically `contextMenus` and `activeTab`.
- **Source Control:** The project will be hosted on GitHub to facilitate open-source collaboration.
- **Deployment Target:** The extension will be packaged and deployed exclusively to the Google Chrome Web Store.

## Epic List

- **Epic 1: Core Functionality & Foundation**
- **Epic 2: Enhanced Interaction & Configuration**
- **Epic 3: Launch Hardening & Quality Gates**
- **Epic 4: Copy Feedback & Diagnostics**
- **Epic 5: MarkQuote Hub & History**
- **Epic 6: Power User & Accessibility Enhancements**

### Risk Mitigation Notes

- **For Epic 1:** Development should prioritize creating a robust and well-tested rich-text-to-markdown conversion engine, as this is the highest technical risk. The project foundation should remain lean and focused on MVP requirements to avoid delays from over-engineering.
- **For Epic 2:** The scope of the options page (FR6) must be carefully managed to prevent unnecessary complexity. A simple, effective implementation should be favored initially. Clear state management for template edits, preview updates, and regex rules is critical to prevent user confusion.

## Epic Details

### Epic 1: Core Functionality & Foundation (Updated)

**Expanded Goal:** The primary objective of this epic is to deliver a functional and valuable Minimum Viable Product (MVP). This involves setting up the complete project structure, including source control and testing, and implementing the core user-facing feature: the ability to select text on a webpage and copy it as a formatted markdown quote using the right-click context menu.

**Stories:**

- **Story 1.1: Project Setup & Foundation**
- **Story 1.2 (Updated): Integrate Markdown Conversion Library**
- **Story 1.3: Implement Clipboard Formatting**
- **Story 1.4: Context Menu Integration**
- **Story 1.5: Handle Images in Selection**

### Epic 2: Enhanced Interaction & Configuration (Updated)

**Expanded Goal:** Building on the core functionality of Epic 1, this epic focuses on enhancing user interaction and providing powerful customization. It will introduce new ways to trigger the copy action (toolbar icon, keyboard shortcut) and implement the options page for users to tailor the source link format to their specific needs.

**Stories:**

- **Story 2.1: Toolbar Icon Action**
- **Story 2.2: Default Keyboard Shortcut**
- **Story 2.3: Basic Settings Page UI**
- **Story 2.4: Implement Source Link Customization**
- **Story 2.5: Add Interactive Examples to Settings**

### Epic 3: Launch Hardening & Quality Gates

**Goal:** Mature MarkQuote from feature-complete to release-ready by polishing UI surfaces, hardening build/publish infrastructure, and expanding automated coverage so regressions are caught before shipping.

**Stories & Branch References:**

- **Story 3.1: Finish Options Page** (`feature/3.1-options-editor`) — finalized the template editor, previews, and restoration flows.
- **Story 3.2: Improve Popup Page** (`feature/3.2-popup-refresh`) — refreshed popup layout and status indicators.
- **Story 3.3: Expand E2E Coverage** (`feature/e2e-richer-playwright`) — broadened Playwright specs beyond single-trigger happy paths.
- **Story 3.4: Optimize Manifest & Publishing** (`chore/manifest-hardening`) — minimized permissions, tuned bundling, and updated store collateral.
- **Story 3.5: Publish Ready** (`story/3.5-publish-ready`) — consolidated release checklist and Chrome Web Store prep.
- **Story 3.6: UX Polish** (`story/3.6-ux-polish`) — in-flight refinements for visual consistency and onboarding copy.
- **Story 3.7: Core Refactor** (`story/3.7-core-refactor`) — reorganized background modules and shared utilities.
- **Story 3.8: Test Coverage & Quality Gate** (`story/3.8-test-coverage`) — established Vitest + Playwright baselines and CI gating.
- **Story 3.9: End-to-End Coverage** (`feat/story-3-9-end-to-end-coverage`) — delivered the first multi-surface E2E suite.
- **Story 3.10: E2E Scenario Matrix Hardening** (`feat/story-3-10-e2e-scenario-matrix`) — stress-tested chained copy flows and failure recovery.

### Epic 4: Copy Feedback & Diagnostics

**Goal:** Deliver richer post-copy feedback and shareable diagnostics so users
and maintainers can triage issues quickly without sacrificing UX.

**Key Decisions & Implementation Notes:**

- Add a persistent "Always show confirmation" toggle in the popup and settings
  surfaces, default it to on, and migrate existing users without losing their
  preference.
- Refresh the post-copy feedback experience (messaging, preview, protected-page
  guidance) so confirmations stay informative without feeling noisy.
- Embed structured diagnostics (trigger source, tab URL, stack, clipboard
  status) in background logs and expose a popup "Copy details" CTA. Use
  URL-safe compression (`jsoncrush`, `lz-string`) when generating GitHub issue
  links so payloads stay lightweight.
- Extend Playwright/Vitest coverage so the error-log lifecycle (seed, badge,
  popup clear) and feedback toggles are exercised end-to-end.
- Expand Playwright coverage to include chained copy scenarios and repeated
  triggers so diagnostics stay resilient across multi-step flows.
- Fold in the backlog alignment work for background initialization and reset
  hygiene so diagnostics, preview caches, and forced overrides stay consistent
  (`docs/stories/backlog/background-initialization-alignment.md`).
- Leverage the diagnostics backlog plan as a baseline for structured payloads
  and shareable exports (`docs/stories/backlog/error-diagnostics-overhaul.md`).
- Document the E2E smoke subset prerequisites (`--grep "[smoke]"`,
  `VITE_E2E=true pnpm build`) so contributors can validate diagnostics stories
  consistently.
- Replace eval-based test timers (`lolex`/`nise`) with safer alternatives to
  avoid false positives in diagnostics-related tests.

**Stories:**

- **Story 4.1: Always-On Confirmation Toggle** — Surface the toggle in popup
  and settings, ensure migrations, and update docs/tests.
- **Story 4.2: Post-Copy Feedback UX Refresh** — Improve messaging, preview,
  and protected-host handling in the popup confirmation flow.
- **Story 4.3: Structured Diagnostics & GitHub Handoff** — Implement the
  enhanced diagnostics pipeline, popup affordance, and URL-safe export.
- **Story 4.4: Background Diagnostics Alignment** — Rename and refactor
  initialization helpers, unify reset flows, and ensure diagnostics caches stay
  in sync across popup and worker contexts.

### Epic 5: MarkQuote Hub & History

**Goal:** Introduce a MarkQuote Hub surface that captures clipboard history,
supports fuzzy search, and exposes retention controls so users can reuse past
captures quickly.

**Key Decisions & Implementation Notes:**

- Build a new extension hub with History and Options tabs, accessible from the
  action popup or dedicated entry point.
- Persist captured entries (markdown, source URL, timestamp) in IndexedDB using
  Dexie/`idb` for structured access.
- Power fuzzy search with MiniSearch, serializing indices to speed startup and
  enable snippet highlighting.
- Provide retention controls (max items, optional age limits) plus export hooks
  so users can manage storage.
- Offer diagnostics-aware export affordances so clipboard history and error
  payloads can be shared safely during support requests.
- This epic subsumes the prior backlog concept "Clipboard History & Search"
  with its hub/navigation/workstream breakdown.

**Stories:**

- **Story 5.1: Hub Surface & Navigation** — Create the hub UI with tabs,
  shared layout tokens, and routing between History/Options.
- **Story 5.2: History Persistence & Search** — Implement Dexie persistence,
  MiniSearch indexing, and fuzzy query APIs.
- **Story 5.3: Retention & Export Controls** — Add retention settings, cleanup
  jobs, and optional export/sharing affordances.

### Epic 6: Power User & Accessibility Enhancements

**Goal:** Unlock advanced workflows and accessible interactions so power users
can tailor MarkQuote without sacrificing usability.

**Key Decisions & Implementation Notes:**

- Provide keyboard-only reordering for rule tables as an accessible alternative
  to drag-and-drop.
- Design a phased approach for per-site formatting rules, starting with
  domain-scoped presets and guardrails for token usage.
- Revisit the selection-activated tooltip concept to assess feasibility and
  potential performance impact before reintroduction.

**Stories:**

- **Story 6.1: Keyboard Reordering Controls** — Implement keyboard-first
  reordering for rule tables and update accessibility guidance.
- **Story 6.2: Per-Site Formatting Rules (Phase 1)** — Introduce domain-level
  formatting overrides with validation and UX cues.
- **Story 6.3: Selection Tooltip Exploration** — Prototype the selection
  affordance, capture performance findings, and decide on rollout.

## Backlog

The former backlog epics for Clipboard History/Search and Core Stability/
Diagnostics are now represented as Epics 5 and 4, respectively. Any new
backlog work will be added directly to the roadmap epics above.

### Future Stories

- **Story: Post-Copy Feedback Popup:** As a user, I want the confirmation popup to appear after every copy by default, with a settings toggle exposed in the popup so I can disable it if I prefer a quieter workflow.
- **Story: Per-Site Formatting Rules:** As a user, I want to define different source URL formats for different websites (e.g., by domain), so that I can have tailored outputs for my most-used sources. A phased rollout (starting with domain-level presets) keeps the authoring rules simple while we validate the UX.

## MVP Validation Strategy

### User Recruitment

The initial user base will be acquired organically by publishing the extension publicly on the Google Chrome Web Store. The project will also be announced via its GitHub repository.

### Feedback Collection

User feedback will be collected through two primary channels:

1. **GitHub Issues:** Users will be encouraged to report bugs and request features via the project's GitHub issue tracker.
2. **Feedback Form:** A simple feedback form will be provided, allowing users to submit feedback directly, with an option to provide their email for follow-up.

### Success Metrics

The MVP will be considered successful if it achieves the following targets within **two months** of public launch:

- **Adoption:** Reaches and maintains at least 100 weekly active users.
- **Satisfaction:** Achieves an average user rating of 4.5 stars or higher on the Chrome Web Store.

## Next Steps

### UX Expert Prompt

Please review this Product Requirements Document (PRD), specifically the 'User Interface Design Goals' section. Based on this, propose a high-level UX and UI design for the options page, keeping in mind the principles of minimalism and browser-native aesthetics.

### Architect Prompt

Please review this Product Requirements Document (PRD), including the requirements, epics, stories, and technical assumptions. Your task is to create a comprehensive software architecture document that outlines the technical design for implementing Epic 1.
<!-- markdownlint-enable MD013 -->
