<!-- markdownlint-disable MD013 -->

# Development Logs

This directory contains chronological records of development work, tracking the lifecycle from initial planning through implementation to completion.

## File Naming Convention

```text
YYYYMMDD-HHMMSS-[description].md
```

**Examples:**

- `20250913-110232-story-1.6-refactoring-plan.md`
- `20250914-143015-story-1.7-implementation-plan.md`
- `20250915-091230-performance-optimization-log.md`

## Log Lifecycle

Each development log typically evolves through these phases:

1. **📋 Planning Phase**

   - Break down tasks into atomic commits
   - Capture a dedicated **Atomic Commit Breakdown** section in the log
   - Define acceptance criteria
   - Identify technical approach

2. **🔄 Active Tracking Phase**

   - Update status as commits are completed
   - Track progress with status indicators (✅ 🔄 ⏳)
   - Document any changes to the plan

3. **✅ Completion Phase**
   - Final status updates
   - Results summary
   - Lessons learned or notes for future work

## Status Indicators

- ✅ **Completed** - Task finished successfully
- 🔄 **In Progress** - Currently working on this task
- ⏳ **Pending** - Planned but not yet started
- ⚠️ **Blocked** - Cannot proceed due to dependencies
- ❌ **Cancelled** - Task no longer needed

## Purpose

These logs serve as:

- **Planning documents** for breaking down complex work
- **Progress tracking** during implementation
- **Historical records** of what was actually done
- **Reference materials** for similar future work
- **Handoff documentation** for team members

## Usage Guidelines

- Create a new log for each significant feature, refactoring, or implementation effort
- Keep logs updated in real-time during development
- Include both successful implementations and lessons from failures
- Reference commit hashes for traceability
- Update the plan if scope or approach changes during implementation
