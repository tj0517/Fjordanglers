# ADR-0005 — Tasks are files in the repo; one task = one prompt = one PR

**Status:** accepted 2026-08-31

## Context
The business plan lives in FigJam and Notion. Engineering tasks for AI agents need to be
readable by Claude Code without MCP, diffable, and reviewable next to the code they
describe. The founders already run this loop on another project with tasks in Notion and
found the MCP dependency the weak point.

## Decision
`docs/tasks/FA-<stage>.<nn>.md`, one file per task, frontmatter for machine-readable
fields, sections Context / Goal / Scope / Done when / Out of scope / Verification.
`docs/tasks/INDEX.md` is the board. The agent loop is: build prompt from the file →
work on a branch → report → review against "Done when" → merge → mark done.
Explicit STOP gates for production writes, history rewrites, deletions and secrets.
Model per task by difficulty, with the human approving anything above Opus.

## Consequences
- No task exists that is not a file; Notion's Platform/Tech project links to the INDEX.
- Task files are edited in PRs like code; "Done when" changes are visible in the diff.
- Reviews can be strict about "proven vs declared" because the criteria are versioned.
