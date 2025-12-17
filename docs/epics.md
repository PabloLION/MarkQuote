<!-- markdownlint-disable MD013 MD024 MD032 -->
# MarkQuote Epics & Stories

**Project:** MarkQuote
**Generated:** 2025-12-15
**Source:** Extracted from PRD

---

## Epic Overview

| Epic | Name | Stories | Status |
|------|------|---------|--------|
| 1 | Core Functionality & Foundation | 1.1-1.5 | Done |
| 2 | Enhanced Interaction & Configuration | 2.1-2.5 | Done |
| 3 | Launch Hardening & Quality Gates | 3.1-3.10 | Done (v1.0.4) |
| 4 | Copy Feedback & Diagnostics | 4.1-4.5 | In Progress (v1.1.0) |
| 5 | MarkQuote Hub & History | 5.1-5.3 | Backlog |
| 6 | Power User & Accessibility | 6.1-6.3 | Backlog |

---

## Epic 1: Core Functionality & Foundation

**Goal:** Deliver a functional and valuable Minimum Viable Product (MVP). This involves setting up the complete project structure, including source control and testing, and implementing the core user-facing feature: the ability to select text on a webpage and copy it as a formatted markdown quote using the right-click context menu.

**Status:** Done

### Stories

| ID | Story | FR Coverage |
|----|-------|-------------|
| 1.1 | Project Setup & Foundation | - |
| 1.2 | Integrate Markdown Conversion Library | FR5 |
| 1.3 | Implement Clipboard Formatting | FR1 |
| 1.4 | Context Menu Integration | FR1, FR2 |
| 1.5 | Handle Images in Selection | FR5 |

---

## Epic 2: Enhanced Interaction & Configuration

**Goal:** Building on the core functionality of Epic 1, this epic focuses on enhancing user interaction and providing powerful customization. It will introduce new ways to trigger the copy action (toolbar icon, keyboard shortcut) and implement the options page for users to tailor the source link format to their specific needs.

**Status:** Done

### Stories

| ID | Story | FR Coverage |
|----|-------|-------------|
| 2.1 | Toolbar Icon Action | FR3 |
| 2.2 | Default Keyboard Shortcut | FR4 |
| 2.3 | Basic Settings Page UI | FR6 |
| 2.4 | Implement Source Link Customization | FR6 |
| 2.5 | Add Interactive Examples to Settings | FR6 |

---

## Epic 3: Launch Hardening & Quality Gates

**Goal:** Mature MarkQuote from feature-complete to release-ready by polishing UI surfaces, hardening build/publish infrastructure, and expanding automated coverage so regressions are caught before shipping.

**Status:** Done (v1.0.4)

### Stories

| ID | Story | Branch | Description |
|----|-------|--------|-------------|
| 3.1 | Finish Options Page | `feature/3.1-options-editor` | Finalize template editor, previews, restoration flows |
| 3.2 | Improve Popup Page | `feature/3.2-popup-refresh` | Refresh popup layout and status indicators |
| 3.3 | Expand E2E Coverage | `feature/e2e-richer-playwright` | Broaden Playwright specs beyond single-trigger happy paths |
| 3.4 | Optimize Manifest & Publishing | `chore/manifest-hardening` | Minimize permissions, tune bundling, update store collateral |
| 3.5 | Publish Ready | `story/3.5-publish-ready` | Consolidated release checklist and Chrome Web Store prep |
| 3.6 | UX Polish | `story/3.6-ux-polish` | Visual consistency and onboarding copy refinements |
| 3.7 | Core Refactor | `story/3.7-core-refactor` | Reorganize background modules and shared utilities |
| 3.8 | Test Coverage & Quality Gate | `story/3.8-test-coverage` | Establish Vitest + Playwright baselines and CI gating |
| 3.9 | End-to-End Coverage | `feat/story-3-9-end-to-end-coverage` | Deliver first multi-surface E2E suite |
| 3.10 | E2E Scenario Matrix Hardening | `feat/story-3-10-e2e-scenario-matrix` | Stress-test chained copy flows and failure recovery |

---

## Epic 4: Copy Feedback & Diagnostics

**Goal:** Deliver richer post-copy feedback and shareable diagnostics so users and maintainers can triage issues quickly without sacrificing UX.

**Status:** In Progress (v1.1.0)

### Key Decisions

- Add persistent "Always show confirmation" toggle (popup and settings)
- Use `chrome.action.openPopup()` API to show popup after hotkey/context-menu copy (works unpinned, Chrome 127+)
- Refresh post-copy feedback experience (messaging, preview, protected-page guidance)
- Embed structured diagnostics in background logs with popup "Copy details" CTA
- Centralize shared runtime constants (clipboard caps, loader timeouts, status labels)
- Extend Playwright/Vitest coverage for error-log lifecycle

### Stories

| ID | Story | Description | Depends On |
|----|-------|-------------|------------|
| 4.5 | Runtime Constant Consolidation | Extract shared constants into single module | - |
| 4.4 | Background Naming & Initialization Alignment | Rename/refactor initialization helpers, unify reset flows | 4.5 |
| 4.3 | Structured Diagnostics & GitHub Handoff | Enhanced diagnostics pipeline, popup affordance, URL-safe export | 4.5, 4.4 |
| 4.2 | Post-Copy Feedback UX Refresh | Improve messaging, preview, protected-host handling | 4.5, 4.4 |
| 4.1 | Always-On Confirmation Toggle | Programmatic popup via `chrome.action.openPopup()` for feedback after non-icon triggers | 4.2, 4.3 |

### Implementation Order

1. **4.5** (foundation) → **4.4** (refactor) → **4.3** + **4.2** (parallel) → **4.1** (flagship)

### Story 4.1 Details: Always-On Confirmation Toggle

**Problem:** When users trigger copy via keyboard shortcut (Alt+C/Option+C) or context menu, they get no visual feedback unless the extension icon is pinned and they click it.

**Solution:** Use `chrome.action.openPopup()` API to programmatically open the popup after copy actions, showing the formatted preview and success/error status.

**Technical Notes:**
- `chrome.action.openPopup()` works for unpinned extensions (Chrome 127+, July 2024)
- No longer requires user gesture or policy installation
- Cannot be called from popup windows (causes crash) - only from background script
- User preference toggle: "Always show confirmation after copy"
- Stored in `chrome.storage.sync` for cross-device sync

**References:**
- [chrome.action.openPopup() API](https://developer.chrome.com/docs/extensions/reference/api/action#method-openPopup)
- [W3C WebExtensions Issue #160](https://github.com/w3c/webextensions/issues/160) - cross-browser alignment

---

## Epic 5: MarkQuote Hub & History

**Goal:** Introduce a MarkQuote Hub surface that captures clipboard history, supports fuzzy search, and exposes retention controls so users can reuse past captures quickly.

**Status:** Backlog

### Key Decisions

- Build new extension hub with History and Options tabs
- Persist captured entries (markdown, source URL, timestamp) in IndexedDB using Dexie/idb
- Power fuzzy search with MiniSearch
- Provide retention controls (max items, optional age limits) plus export hooks

### Stories

| ID | Story | Description |
|----|-------|-------------|
| 5.1 | Hub Surface & Navigation | Create hub UI with tabs, shared layout tokens, routing |
| 5.2 | History Persistence & Search | Implement Dexie persistence, MiniSearch indexing, fuzzy query APIs |
| 5.3 | Retention & Export Controls | Add retention settings, cleanup jobs, export/sharing affordances |

---

## Epic 6: Power User & Accessibility Enhancements

**Goal:** Unlock advanced workflows and accessible interactions so power users can tailor MarkQuote without sacrificing usability.

**Status:** Backlog

### Key Decisions

- Provide keyboard-only reordering for rule tables as accessible alternative to drag-and-drop
- Design phased approach for per-site formatting rules
- Revisit selection-activated tooltip concept

### Stories

| ID | Story | Description |
|----|-------|-------------|
| 6.1 | Keyboard Reordering Controls | Implement keyboard-first reordering for rule tables |
| 6.2 | Per-Site Formatting Rules (Phase 1) | Introduce domain-level formatting overrides |
| 6.3 | Selection Tooltip Exploration | Prototype selection affordance, capture performance findings |

---

## FR Coverage Matrix

| FR | Description | Epic | Stories |
|----|-------------|------|---------|
| FR1 | Copy Selection as Markdown with Reference | Epic 1 | 1.3, 1.4 |
| FR2 | Context Menu Integration | Epic 1 | 1.4 |
| FR3 | Toolbar Icon Action | Epic 2 | 2.1 |
| FR4 | Default Keyboard Shortcut | Epic 2 | 2.2 |
| FR5 | Rich Text to Markdown Conversion | Epic 1 | 1.2, 1.5 |
| FR6 | Customizable Source URL Formatting | Epic 2 | 2.3, 2.4, 2.5 |

---

## NFR Coverage

| NFR | Description | Epic Coverage |
|-----|-------------|---------------|
| NFR1 | Performance | Epic 3 (optimization), Epic 4 (diagnostics) |
| NFR2 | Usability | Epic 3 (UX polish), Epic 6 (accessibility) |
| NFR3 | Browser Compatibility | Epic 3 (manifest hardening) |
| NFR4 | Permissions | Epic 3 (manifest optimization) |
| NFR5 | Error Handling | Epic 4 (diagnostics) |
| NFR6 | Open-Source | Maintained throughout |
