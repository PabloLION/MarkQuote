# Project Brief: MarkQuote

## Executive Summary

MarkQuote is a Chrome extension that streamlines the process of referencing web content in markdown-based notes. The extension allows users to copy selected rich text from a webpage and instantly convert it into a markdown blockquote that includes a formatted source link, all in a single action. The primary problem it solves is the inefficient workflow of manually copying text, grabbing the source URL and title, and then formatting it all for documentation or note-taking. MarkQuote is targeted at knowledge workers, researchers, students, and developers who rely on markdown. The key value proposition is a significant increase in efficiency when capturing and citing web content.

## Problem Statement

When taking notes or writing documentation, users frequently need to reference content from various webpages. The current process is manual, repetitive, and inefficient. It involves multiple steps: selecting and copying text, switching tabs to copy the URL, manually typing or copying the page title, and then formatting all of this information into a markdown reference. This multi-step process is tiring, error-prone, and disrupts the user's workflow, especially when performed multiple times. Existing solutions lack the seamless, single-action functionality required to make this process effortless.

## Proposed Solution

The proposed solution is a lightweight, intuitive Chrome extension named MarkQuote. It integrates directly into the user's browsing experience to provide a one-click solution for capturing and referencing web content. The core of the solution is a function that copies selected on-page text and automatically formats it into a markdown blockquote, complete with a source link containing the page title and URL. This functionality will be accessible via a right-click context menu option, ensuring it is available precisely when needed without cluttering the UI.

## Target Users

### Primary User Segment: Knowledge Workers & Developers

- **Profile:** Professionals and hobbyists (writers, researchers, programmers, content creators) who use markdown for note-taking (in apps like Obsidian, Notion, Joplin), documentation, and knowledge management.
- **Behaviors:** Frequently gather information from multiple web sources and consolidate it into their own documents. Value efficiency and keyboard-centric workflows.
- **Needs:** A frictionless way to cite sources without breaking their writing flow. Accurate conversion of rich text to markdown.

### Secondary User Segment: Students & Academics

- **Profile:** University students and researchers compiling notes, bibliographies, and research data.
- **Behaviors:** Heavy reliance on web-based articles, journals, and sources for their work.
- **Needs:** An easy way to keep track of where information was sourced. A simple tool that doesn't require a steep learning curve.

## Goals & Success Metrics

### Project Objectives

- **Goal:** Deliver a highly efficient, intuitive tool for the open-source community that streamlines the capture of web content into markdown.
- **Metric:** Achieve a high rating (4.5+ stars) in the Chrome Web Store.
- **Metric:** Foster an active open-source community around the project on GitHub, measured by forks, stars, and community contributions.

### User Success Metrics

- **Metric:** High adoption and retention rate, measured by weekly active users.
- **Metric:** Frequent use of the core "copy as markdown" feature, measured by daily activation events.

### Key Performance Indicators (KPIs)

- **Downloads:** Total number of installations from the Chrome Web Store.
- **Active Users:** Daily and Weekly Active Users (DAU/WAU).
- **Error Rate:** Percentage of copy operations that fail or produce incorrect output, kept below 0.1%.

## MVP Scope

### Core Features (Must Have)

- **FR1 - Copy Selection as Markdown:** The core function to copy selected text into a pre-formatted markdown blockquote with a source link.
- **FR2 - Context Menu Integration:** An option in the right-click menu to trigger the copy action on selected text.
- **FR5 - Rich Text to Markdown Conversion:** Accurately convert basic formatting like bold, italics, and lists.
- **NFRs - Foundational:** The MVP must be performant (NFR1), usable (NFR2), compatible with the latest Chrome (NFR3), use minimal permissions (NFR4), and handle errors gracefully (NFR5).

### Out of Scope for MVP

- **Toolbar Icon Action (FR3):** Copying the entire page content via a toolbar click will be considered for a future release to keep the MVP focused on the primary selection-based workflow.
- **Customizable Keyboard Shortcut (FR4):** While important for power users, this adds configuration overhead and will be implemented post-MVP.
- **Dynamic Title Formatting (FR6):** Advanced title cleanup using regex is a powerful but non-essential feature for the initial release.

### MVP Success Criteria

The MVP will be considered successful if it is approved for the Chrome Web Store, receives positive initial user feedback (averaging 4+ stars), and demonstrates a stable, low-error-rate performance in the wild.

## Post-MVP Vision

### Phase 2 Features

- Implement the features deferred from the MVP: a toolbar icon for full-page capture (FR3), a customizable keyboard shortcut (FR4), and an options page for dynamic title formatting with regex (FR6).

### Long-term Vision

- Evolve into a comprehensive markdown web-clipping tool. This could include more advanced format customization, support for other browsers (like Firefox), and integrations with popular note-taking applications.

### Expansion Opportunities

- **Format Templates:** Allow users to define their own output templates beyond the default blockquote format.
- **Image Handling:** Add functionality to include images from the selection in the markdown output.

## Technical Considerations

### Platform Requirements

- **Target Platforms:** Google Chrome (latest version).
- **Performance Requirements:** The copy operation must feel instantaneous (<100ms) to the user.

### Technology Preferences

- **Core:** HTML, CSS, JavaScript (ES6+). No heavy frameworks are needed for the core functionality to ensure performance.
- **Hosting/Infrastructure:** Code will be hosted on GitHub, leveraging its platform for community engagement. Distribution via the Chrome Web Store.

### Architecture Considerations

- **Repository Structure:** A single repository on GitHub containing all extension code and documentation.
- **Permissions:** The extension will require minimal permissions: `contextMenus` for the right-click option and `activeTab` to access page title and URL.

## Constraints & Assumptions

### Constraints

- **Platform:** The extension is exclusively for the Google Chrome browser at launch.
- **Open-Source:** The project will be developed and maintained as open-source software under a permissive license (e.g., MIT).

### Key Assumptions

- Users prefer the specific `> [text] > Source: [title](url)` format.
- The target audience is comfortable with and actively uses markdown.
- Basic rich text to markdown conversion will cover the majority of use cases.

## Risks & Open Questions

### Key Risks

- **Web Page Variability:** The structure of HTML on different websites can be inconsistent, making 100% accurate rich text to markdown conversion a significant challenge.
- **Chrome API Changes:** Future updates to the Chrome Extension Manifest or APIs could introduce breaking changes requiring maintenance.

### Open Questions

- What is the most intuitive and non-conflicting default keyboard shortcut for the post-MVP release?
- Are there other popular markdown reference formats that should be supported as options in the future?

## Next Steps

### Immediate Actions

1. Set up the GitHub repository and initialize the project structure.
2. Develop the core MVP functionality (FR1, FR2, FR5).
3. Test the extension across a wide variety of websites.
4. Prepare assets and listing information for the Chrome Web Store.

### PM Handoff

This Project Brief provides the full context for MarkQuote. The next step is to begin development of the MVP, focusing on the core features and non-functional requirements outlined above.
