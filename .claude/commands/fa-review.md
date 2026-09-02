---
description: Review a finished task against its "Done when" — proven vs declared, DB claims by query, omissions, verdict
argument-hint: <task id or PR number>
---

Target: $ARGUMENTS

Delegate to `fa-reviewer` with this brief and return its output unchanged:

- Task file: `docs/tasks/<id>.md` (resolve from the PR branch name if a PR number was given).
- Diff: `git diff main...HEAD` on the task branch, or the PR diff.
- Report: the "Notatki z realizacji" section and the PR body.
- Environment for DB verification: whatever the task names (`touches_prod` tells you
  whether production reads are in scope; **reads only**, ever).

Expected output, in this order:
1. Verdict in one sentence: accept / accept with follow-ups / send back.
2. Coverage table — one row per "Gotowe, gdy" item: proven / declared / uncovered + evidence line.
3. Re-run results: typecheck, lint, test, build, `db diff`, the task's own verification commands.
4. Red proofs present / missing for every new guard, constraint, policy, trigger, transition rule.
5. Omissions found (from the standard list in `fa-reviewer`).
6. Side-effect assessment on the live inquiry → offer → deposit path.
7. Follow-ups ordered by damage potential.
8. Ready-to-paste message for the implementer.
9. Proposed task status (`done` only if every criterion is proven) and the exact line to
   change in `docs/tasks/INDEX.md`.
