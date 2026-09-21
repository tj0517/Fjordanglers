# Knowledge base — FA agent drafts

Files in this directory are loaded by `src/lib/ai/knowledge.ts` when the admin clicks
"zaproponuj" on an inquiry. The loader picks files based on the inquiry's country and
assigned guide; the assembled content is injected into the draft-reply prompt.

Content and structure of the prompt itself: → `src/lib/ai/draft-reply-prompt.ts` (FA-1.17).

## File format

Every file starts with a YAML frontmatter block:

```markdown
---
kind: tone | destination | guide | offer
country: Iceland            # destination and guide files only
regions: [Westfjords, ...]  # optional; destination files only
guide_name: Josh Hart       # guide files only — must match guides.full_name exactly (case-insensitive)
---

File content in plain Markdown.
```

## Selection rules

| Directory | `kind` | When loaded |
|---|---|---|
| `tone/` | `tone` | Always — every draft includes all tone files |
| `destinations/` | `destination` | When the inquiry's `trip_country` matches `country` |
| `guides/` | `guide` | When the inquiry's assigned guide matches `guide_name` (case-insensitive) |
| `offers/` | `offer` | Reserved — not yet used by the loader |

If the inquiry has no `trip_country` set, destination files are skipped.
If no guide is assigned, guide files are skipped.

## Adding a new file

1. Create a `.md` file in the appropriate subdirectory.
2. Add the frontmatter block with the correct `kind` and matching fields.
3. Write the content — plain prose, no strict format required by the loader.
4. Run `pnpm test -- knowledge` to verify the loader picks it up in fixture tests.

Files here are loaded at request time (no build step). Changes take effect immediately
on the next "zaproponuj" click without restarting the server.
