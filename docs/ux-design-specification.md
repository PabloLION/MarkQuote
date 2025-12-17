---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
inputDocuments:
  - docs/prd.md
  - docs/brief.md
  - docs/epics.md
  - docs/ui-architecture.md
workflowType: 'ux-design'
lastStep: 14
project_name: 'MarkQuote'
user_name: 'Pablo'
date: '2025-12-15'
---

# UX Design Specification: MarkQuote

**Author:** Pablo
**Date:** 2025-12-15

---

<!-- UX design content will be appended sequentially through collaborative workflow steps -->

## Executive Summary

### Project Vision

MarkQuote transforms the tedious multi-step process of quoting web content into markdown into a single, seamless action. The extension embodies the principle of "invisible computing" - powerful functionality that feels like a natural extension of the browser itself.

### Target Users

**Primary Users:**
- Knowledge workers using markdown-based note-taking tools (Obsidian, Notion, Roam)
- Developers referencing documentation and Stack Overflow
- Students and researchers citing web sources
- Technical writers and content creators

**User Characteristics:**
- Tech-comfortable but not necessarily technical
- Value efficiency and keyboard-driven workflows
- Already familiar with markdown syntax
- Frustrated by repetitive copy-paste-format cycles

### Key Design Challenges

1. **Invisible but Discoverable** - Feel like a native browser feature while remaining discoverable
2. **Options Page Complexity** - Make regex-based customization accessible to non-technical users
3. **Feedback Without Interruption** - Confirm success without disrupting reading flow
4. **Cross-Context Consistency** - Unified mental model across all interaction methods

### Design Opportunities

1. **Smart Defaults** - Pre-configured rules for common sites eliminate setup friction
2. **Progressive Disclosure** - Simple surface, advanced depth when needed
3. **Live Preview** - Real-time feedback makes abstract concepts tangible
4. **Graceful Degradation** - Clear guidance when features are unavailable

## Core User Experience

### Defining Experience

**Core Action:** Select text → Trigger copy → Paste formatted markdown

The entire value proposition happens in under 2 seconds. Users should feel like the browser learned a new trick just for them.

### Platform Strategy

**Platform:** Chrome Extension (Desktop Browser)

**Primary Interactions:**
- Context menu (right-click) - Discovery-friendly
- Toolbar icon - Visual reminder of capability
- Keyboard shortcut (Alt+C) - Power user efficiency

**Platform Considerations:**
- Chrome Extension Manifest V3 architecture
- Minimal permissions for user trust
- Protected pages require graceful failure handling

### Effortless Interactions

**Must be effortless:**
- Copy action (< 500ms perception threshold)
- Result quality (no post-paste cleanup)
- Default behavior (works perfectly out of box)

**Eliminate friction:**
- No popup required for basic copy
- No configuration needed for common sites
- No learning curve for basic usage

### Critical Success Moments

1. **First Copy** - "This is exactly what I needed"
2. **Perfect Paste** - Markdown renders correctly everywhere
3. **Second Use** - Muscle memory forms, becomes habit
4. **Share Discovery** - User tells others about the extension

### Experience Principles

1. **Invisible Until Needed** - Feel like native browser functionality
2. **Zero Configuration Required** - Smart defaults for immediate value
3. **Instant Confidence** - Clear feedback that action succeeded
4. **Graceful Boundaries** - Helpful guidance when features are unavailable

## Desired Emotional Response

### Primary Emotional Goals

**Primary: Effortless Competence**
Users feel like power users without any learning curve. The tool amplifies capability without demanding attention.

**Secondary: Quiet Delight**
Small moments of satisfaction when output is perfect and defaults just work.

**Emotions to Avoid:**
- Interruption - Never break reading flow
- Confusion - Every state immediately clear
- Doubt - Always know if copy succeeded

### Emotional Journey Mapping

| Stage | Desired Emotion |
|-------|-----------------|
| Install | Curiosity |
| First copy | Pleasant surprise |
| Paste result | Satisfaction |
| Regular use | Invisible mastery |
| Error state | Understanding (not frustration) |

### Micro-Emotions

- **Confidence over Confusion** - Predictable, reliable behavior
- **Trust over Skepticism** - Minimal permissions, transparency
- **Satisfaction over Delight** - Reliable beats flashy for utilities

### Emotional Design Principles

1. **Invisible Success** - The best UX is when users don't notice the UX
2. **Earned Trust** - Minimal permissions, no surprises, predictable behavior
3. **Graceful Failure** - Errors inform rather than frustrate
4. **Subtle Feedback** - Confirmation without interruption

## Inspiration & Reference

### Design Inspirations

**Browser-Native Extensions:**
- **1Password** - Minimal popup, clear status indicators, keyboard-driven
- **Grammarly** - Unobtrusive inline feedback, simple toggle states
- **Refined GitHub** - Options page with toggles and previews

**Key Patterns to Adopt:**
- Chrome's native UI conventions (colors, spacing, typography)
- Minimal popup footprint - show only essential info
- Options page progressive disclosure - simple defaults, advanced expandable

### Anti-Patterns to Avoid

- Overly branded extension UIs that feel foreign in Chrome
- Popups that require scrolling
- Options pages that overwhelm with all settings visible
- Confirmation dialogs that block workflow

## Design System

### Color Palette

**Chrome Extension Context:**
Extensions should feel native to Chrome, using system colors where possible.

| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| `--bg-primary` | `#ffffff` | `#292929` | Popup/options background |
| `--bg-secondary` | `#f1f3f4` | `#3c3c3c` | Section backgrounds |
| `--text-primary` | `#202124` | `#e8eaed` | Primary text |
| `--text-secondary` | `#5f6368` | `#9aa0a6` | Secondary/help text |
| `--accent` | `#1a73e8` | `#8ab4f8` | Links, buttons, focus |
| `--success` | `#188038` | `#81c995` | Success states |
| `--error` | `#c5221f` | `#f28b82` | Error states |
| `--border` | `#dadce0` | `#5f6368` | Dividers, borders |

### Typography

**Font Stack:** System fonts for native feel
```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
```

| Element | Size | Weight | Usage |
|---------|------|--------|-------|
| Popup Title | 14px | 500 | Popup header |
| Body Text | 13px | 400 | General content |
| Caption | 11px | 400 | Help text, labels |
| Button | 13px | 500 | Action buttons |

### Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | 4px | Tight inline spacing |
| `--space-sm` | 8px | Related elements |
| `--space-md` | 12px | Section padding |
| `--space-lg` | 16px | Major sections |
| `--space-xl` | 24px | Page margins |

## UI Surfaces

### Surface 1: Popup (Action Popup)

**Purpose:** Quick status feedback and copy confirmation

**Dimensions:** 320px × auto (content-driven, max 400px height)

**States:**

| State | Content | Duration |
|-------|---------|----------|
| **Ready** | "Select text and right-click to copy" | Persistent |
| **Success** | Preview of copied markdown + "Copied!" | 3s then fade |
| **Error** | Error message + guidance | Until dismissed |
| **Protected** | "Can't access this page" + help link | Until dismissed |

**Layout:**
```
┌─────────────────────────────────┐
│ MarkQuote              [⚙️] [×] │
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ Preview area (monospace)    │ │
│ │ Shows formatted markdown    │ │
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│ Status: ✓ Copied to clipboard   │
│ [Always show confirmation ☑]    │
└─────────────────────────────────┘
```

### Surface 2: Options Page

**Purpose:** Template customization, regex rules, settings

**Layout Strategy:** Single-page with collapsible sections

**Sections:**

1. **Template Editor** (expanded by default)
   - Textarea for markdown template
   - Token buttons: {{TEXT}}, {{TITLE}}, {{URL}}
   - Live preview panel
   - Reset to default button

2. **URL Rules** (collapsed by default)
   - Table: Pattern | Replacement | Enabled | Actions
   - Drag-to-reorder handles
   - Add rule button
   - Pre-built rules (Wikipedia, Amazon, etc.)

3. **Title Rules** (collapsed by default)
   - Same structure as URL rules

4. **Settings** (collapsed by default)
   - Always show confirmation toggle
   - Export/Import settings

**Layout:**
```
┌────────────────────────────────────────────────┐
│ MarkQuote Options                              │
├────────────────────────────────────────────────┤
│ ▼ Template                                     │
│ ┌────────────────────┬───────────────────────┐ │
│ │ [{{TEXT}}] [{{T}}] │  Preview:             │ │
│ │ ┌────────────────┐ │  > Selected text      │ │
│ │ │ > {{TEXT}}     │ │  > Source: [Title]... │ │
│ │ │ > Source: ...  │ │                       │ │
│ │ └────────────────┘ │                       │ │
│ │ [Reset to Default] │                       │ │
│ └────────────────────┴───────────────────────┘ │
│                                                │
│ ▶ URL Transformation Rules (3 rules)          │
│ ▶ Title Transformation Rules (2 rules)        │
│ ▶ Settings                                    │
└────────────────────────────────────────────────┘
```

### Surface 3: Context Menu

**Browser-native** - No custom styling possible

**Menu Item:** "Copy as Markdown Quote"
- Only appears when text is selected
- Icon: MarkQuote logo (16px)

## User Journeys

### Journey 1: First-Time User

```
Install extension
    ↓
Visit any webpage
    ↓
Select text → Right-click → See "Copy as Markdown Quote"
    ↓
Click menu item
    ↓
Popup shows: "✓ Copied!" with preview
    ↓
Paste in markdown editor → Perfect result
    ↓
😊 "This is exactly what I needed"
```

### Journey 2: Power User (Daily Use)

```
Select text → Alt+C (hotkey)
    ↓
Brief confirmation (if enabled)
    ↓
Continue reading → Paste when ready
    ↓
No workflow interruption
```

### Journey 3: Customization

```
Click extension icon → Settings gear
    ↓
Options page opens
    ↓
Edit template → See live preview update
    ↓
Add URL rule for personal wiki
    ↓
Test with copy → Preview shows transformation
    ↓
Save automatically
```

### Journey 4: Error Recovery

```
Visit chrome:// page → Try to copy
    ↓
Popup shows: "Can't access Chrome pages"
    ↓
Helpful text: "Try on a regular webpage"
    ↓
User understands limitation (not frustrated)
```

## Component Strategy

### Shared Components

| Component | Usage | Behavior |
|-----------|-------|----------|
| `StatusBadge` | Success/error states | Color-coded, icon + text |
| `PreviewPanel` | Markdown preview | Monospace, syntax highlighting |
| `RuleTable` | URL/Title rules | Sortable, inline edit |
| `TokenButton` | Template tokens | Insert at cursor |
| `Toggle` | Boolean settings | Standard checkbox style |
| `CollapsibleSection` | Options groups | Expand/collapse with chevron |

### State Management

**Storage:**
- `chrome.storage.sync` - User settings (template, rules)
- `chrome.storage.session` - Pending copy state

**State Flow:**
```
User Action → Background Worker → Content Script → Clipboard
                    ↓
              Storage Update
                    ↓
              Popup/Options React
```

## UX Patterns

### Feedback Patterns

| Action | Feedback | Timing |
|--------|----------|--------|
| Copy success | Green checkmark + "Copied!" | Immediate, 3s fade |
| Copy failure | Red icon + error message | Until dismissed |
| Settings saved | None (auto-save implied) | - |
| Rule added | Row appears in table | Immediate |
| Rule deleted | Row removed + undo option | 5s undo window |

### Error Handling Patterns

| Error Type | User Message | Action |
|------------|--------------|--------|
| No text selected | "Select some text first" | Dismiss |
| Protected page | "Can't access this page" | Link to help |
| Clipboard failed | "Couldn't copy - try again" | Retry button |
| Invalid regex | "Invalid pattern" + highlight | Inline fix |

### Loading Patterns

**Philosophy:** Nothing should take long enough to need a loader

| Operation | Max Duration | If Exceeded |
|-----------|--------------|-------------|
| Copy action | 500ms | Show "Processing..." |
| Options load | 200ms | Skeleton UI |
| Preview update | 100ms | Debounce input |

## Responsive & Accessibility

### Responsive Behavior

**Popup:** Fixed width (320px), content-driven height
**Options:** Responsive single-column on narrow, two-column preview on wide

| Breakpoint | Options Layout |
|------------|----------------|
| < 600px | Single column, preview below |
| ≥ 600px | Two columns, preview beside |

### Accessibility Requirements

**WCAG 2.1 AA Compliance:**

| Requirement | Implementation |
|-------------|----------------|
| Color contrast | 4.5:1 minimum for text |
| Focus visible | 2px outline on interactive elements |
| Keyboard nav | Full keyboard access to all controls |
| Screen reader | ARIA labels on icons, live regions for status |
| Reduced motion | Respect `prefers-reduced-motion` |

**Keyboard Shortcuts:**

| Key | Action (in Options) |
|-----|---------------------|
| Tab | Navigate between controls |
| Enter | Activate buttons, expand sections |
| Escape | Close popup, cancel edit |
| Arrow keys | Navigate within rule tables |

### Focus Management

- Popup: Focus trap within popup when open
- Options: Logical tab order top-to-bottom
- Modals: Focus first interactive element, return focus on close

## Implementation Notes

### CSS Custom Properties

All colors and spacing use CSS custom properties for:
- Easy dark mode switching
- Consistent theming
- Potential user customization

### Animation Guidelines

```css
/* Standard transition for interactive elements */
transition: all 150ms ease-out;

/* Respect user preferences */
@media (prefers-reduced-motion: reduce) {
  * { transition: none !important; }
}
```

### Browser Compatibility

- Target: Chrome 88+ (Manifest V3 baseline)
- CSS: Modern features with graceful fallback
- JS: ES2020+ (Chrome supports natively)

---

## Summary

This UX specification defines MarkQuote as a **minimalist, invisible utility** that amplifies user capability without demanding attention. The design prioritizes:

1. **Native feel** - Chrome's visual language, system fonts
2. **Instant value** - Zero configuration for immediate benefit
3. **Progressive depth** - Advanced features discoverable but hidden
4. **Graceful failure** - Errors inform, never frustrate

**Key Metrics:**
- Time to first successful copy: < 10 seconds from install
- Configuration required for 80% of users: None
- Maximum popup interaction time: < 3 seconds
