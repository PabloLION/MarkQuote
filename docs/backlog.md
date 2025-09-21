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
