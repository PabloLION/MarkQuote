# Story 3.6: UX Polish

**Status:** ready-for-dev

## Story

**As a** user who interacts with popup and options surfaces,
**I want** consistent typography, spacing, and visual refinements across all UI,
**so that** MarkQuote feels polished, professional, and cohesive before launch.

## Acceptance Criteria

1. **AC1:** Popup and options surfaces use the same typography scale (headings, body, details) from shared design tokens.
2. **AC2:** All spacing follows the UX design specification scale (4px, 8px, 12px, 16px, 24px) via CSS custom properties.
3. **AC3:** All interactive elements pass WCAG 2.1 AA contrast requirements (4.5:1 minimum) and have visible focus states.
4. **AC4:** Empty states describe what will appear once data exists and link to the relevant action.
5. **AC5:** String updates are documented in the codebase with consistent tone.
6. **AC6:** Manual smoke test confirms no layout regressions in light/dark modes.

## Tasks / Subtasks

- [ ] **Task 1: Extract typography tokens to shared.css** (AC: 1, 2)
  - [ ] Add `--font-size-title`, `--font-size-body`, `--font-size-caption` variables
  - [ ] Add `--font-weight-normal`, `--font-weight-medium`, `--font-weight-bold` variables
  - [ ] Add spacing tokens: `--space-xs` (4px), `--space-sm` (8px), `--space-md` (12px), `--space-lg` (16px), `--space-xl` (24px)
  - [ ] Update popup.html to consume shared typography tokens
  - [ ] Update options.html to consume shared typography tokens

- [ ] **Task 2: Audit and fix contrast ratios** (AC: 3)
  - [ ] Verify all text colors against backgrounds meet 4.5:1 ratio
  - [ ] Ensure focus-visible outlines are clearly visible (2px solid accent)
  - [ ] Test badge, status-message, and error-container in both themes

- [ ] **Task 3: Standardize button and control styling** (AC: 1, 3)
  - [ ] Unify button padding and border-radius across surfaces
  - [ ] Ensure consistent hover/focus states
  - [ ] Remove inline style overrides where shared styles suffice

- [ ] **Task 4: Refine empty and loading states** (AC: 4)
  - [ ] Add empty state messaging when no rules exist in options page
  - [ ] Ensure popup shows helpful message when no text is selected
  - [ ] Add loading indicators where async operations occur

- [ ] **Task 5: Finalize string copy** (AC: 5)
  - [ ] Review all user-facing strings for tone consistency
  - [ ] Update placeholder text to be instructive
  - [ ] Ensure error messages are actionable

- [ ] **Task 6: Visual regression verification** (AC: 6)
  - [ ] Capture before/after screenshots in light mode
  - [ ] Capture before/after screenshots in dark mode
  - [ ] Run `pnpm test:e2e` to verify no functional regressions

## Dev Notes

### Architecture Compliance

- **Technology Stack:** Vanilla TypeScript/HTML/CSS only - no frameworks [Source: docs/ui-architecture.md:11-16]
- **Styling Approach:** CSS custom properties for theming, no CSS-in-JS [Source: docs/ui-architecture.md:242-252]
- **Build Tool:** Vite for compilation and bundling [Source: docs/ui-architecture.md:27]

### UX Design Specification Alignment

**Typography Scale (from UX spec):**
| Element | Size | Weight |
|---------|------|--------|
| Popup Title | 14px | 500 |
| Body Text | 13px | 400 |
| Caption | 11px | 400 |
| Button | 13px | 500 |

**Spacing Scale:**
| Token | Value |
|-------|-------|
| `--space-xs` | 4px |
| `--space-sm` | 8px |
| `--space-md` | 12px |
| `--space-lg` | 16px |
| `--space-xl` | 24px |

**Color Tokens (already in shared.css):**
- Light/dark mode variables via `prefers-color-scheme`
- Accent: `#2563eb` / `#3b82f6`
- Success: `#047857` / `#34d399`
- Danger: `#dc2626` / `#f87171`

[Source: docs/ux-design-specification.md:165-206]

### File Structure

Files to modify:
```
public/
├── styles/
│   ├── base.css          # Add font stack if missing
│   └── shared.css        # Add typography/spacing tokens
├── popup.html            # Consume shared tokens, reduce inline styles
└── options.html          # Consume shared tokens, reduce inline styles
```

### Current State Analysis

**Existing Design Tokens (shared.css):**
- `--surface-background`, `--surface-foreground` ✅
- `--panel-background` ✅
- `--border-color` ✅
- `--accent-color`, `--accent-foreground` ✅
- `--danger-color`, `--status-success` ✅

**Missing Tokens:**
- Typography scale (font sizes, weights)
- Spacing scale (xs, sm, md, lg, xl)

**Popup-specific inline styles to extract:**
- Status message styling (lines 56-101)
- Badge styling (lines 135-150)
- Error container styling (lines 152-186)

**Options-specific inline styles to extract:**
- Section styling (lines 36-43)
- Table styling (lines 185-245)
- Form control styling (lines 100-126)

### Testing Requirements

- **Unit Tests:** Not required for CSS changes
- **E2E Tests:** Run existing Playwright suite to verify no regressions
- **Manual Tests:**
  - Open popup in light/dark mode
  - Open options page in light/dark mode
  - Verify keyboard navigation works
  - Check all focus states are visible

### Previous Story Learnings

From Story 3.7 (Core Refactor):
- Shared CSS extraction pattern established in `public/styles/shared.css`
- Popup/options both import base.css then shared.css
- Keep changes scoped to avoid regressions

### Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| CSS regressions | Keep changes scoped, capture before/after screenshots |
| String churn | Review copy with product owner before finalizing |
| Time creep | Postpone non-essential animation work to future story |

## References

- [UX Design Specification](docs/ux-design-specification.md)
- [UI Architecture](docs/ui-architecture.md)
- [PRD NFR2: Usability](docs/prd.md#non-functional)
- Branch: `story/3.6-ux-polish`

## Dev Agent Record

### Context Reference

- Epic 3: Launch Hardening & Quality Gates
- Related: Story 3.1 (Options Page), Story 3.2 (Popup Page), Story 3.7 (Core Refactor)

### Agent Model Used

_To be filled during implementation_

### Debug Log References

_To be filled during implementation_

### Completion Notes List

_To be filled during implementation_

### File List

_To be filled during implementation_

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2025-12-15 | 1.0 | Comprehensive story context created via BMM create-story workflow | Claude |
