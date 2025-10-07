# Project Backlog

This file tracks features and tasks that are planned for future development cycles.

## Epic 3: Quality and Test Automation

### Story: Implement End-to-End (E2E) Test Suite

**Goal:** To ensure long-term stability and prevent regressions by creating a comprehensive automated E2E test suite.

**Tasks:**

- Set up and configure the Playwright test runner.
- Write E2E tests for the core user journeys:
  - Copying a selection and verifying the clipboard content.
  - Verifying the functionality of the options page, including saving and applying title transformation rules.
- Testing the popup page UI and interactions.
- Integrate the E2E test suite into a CI/CD pipeline to run automatically.

### Follow-up: Story 3.9 Completion Tasks

**Goal:** Finish the remaining Playwright coverage required for the 1.1 release.

**Tasks:**

- Add an onboarding smoke test that resets storage, opens the popup with default settings, triggers a copy, and asserts the default template output.
- After the onboarding flow exists, add an error-log lifecycle test that seeds background errors, confirms badge + popup list state, and clears the log via the UI.

## Epic 4: Host Access UX

### Story: Streamline Hotkey Permissions

**Goal:** Let users copy without opening the popup by guiding them to grant per-site access for the keyboard shortcut.

**Notes:** Interim behavior opens the popup whenever the hotkey fires so the action gains `activeTab` permissions. Restore the streamlined flow once optional host access is available.

**Tasks:**

- Surface a CTA in the popup error panel to request host access for the current site.
- Update the background command to skip opening the popup when the site is already authorized.
- Add automated coverage for the permission request + fallback behavior.

## Epic 5: Accessibility Polish

### Story: Keyboard Reordering for Rules Tables

**Goal:** Provide a keyboard-accessible alternative to drag-and-drop when reordering title and URL rules on the options page.

**Tasks:**

- Introduce focusable move controls (e.g., up/down buttons or keyboard shortcuts) for each rule row.
- Announce position changes via ARIA live regions to keep screen reader users informed.
- Update documentation and tests to cover the non-pointer interaction path.

## Epic 6: Configuration Hygiene

### Story: Centralize Shared Runtime Constants

**Goal:** Reduce duplication and misalignment by moving clipboard limits, loader timeouts, and UI status values into a single configuration module.

**Tasks:**

- Audit the extension for duplicated configuration literals (e.g., loader timeouts, clipboard caps, status labels).
- Create a shared runtime constants module that can be imported by background, popup, and options surfaces without circular dependencies.
- Update existing modules to consume the shared constants and adjust tests/documentation accordingly.
