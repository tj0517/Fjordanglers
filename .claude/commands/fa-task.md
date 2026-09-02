---
description: Build the working prompt for a task in docs/tasks/ and start it (one task = one branch = one PR)
argument-hint: <task id, e.g. FA-1.03>
---

Task id: $ARGUMENTS

Do exactly this, in order:

1. **Load the task.** Read `docs/tasks/$ARGUMENTS.md`. If it does not exist, list
   `docs/tasks/INDEX.md` rows with status `todo` whose `depends_on` are all `done`, pick
   the earliest stage, and confirm the choice in one sentence before continuing.

2. **Check it can be done now.**
   - Every id in `depends_on` has `status: done` in its file — else stop and say which.
   - `blocked_by_questions` is empty — else quote the `O-xx` row from
     `docs/04-open-questions.md` and stop; you do not resolve open questions.
   - `status` is `todo` — if `in_progress`, ask whether to resume.

3. **Read the context** — every path under "Kontekst — przeczytaj przed startem", fully.
   Then `CLAUDE.md` and `docs/05-agent-operations.md` if not already listed.

4. **Confront "Gotowe, gdy" with reality** before you accept it. For each criterion, do
   the cheap check that tells you whether it is achievable and consistent with the scope:
   a grep, a file open, an `information_schema` query, a `db diff`. If a criterion is
   impossible, contradictory, or already satisfied, say so **now** with the evidence and
   propose a replacement — do not start work against a criterion you know is wrong.

5. **Model and effort.** Read `difficulty`, `model`, `effort`, `model_approved` from the
   frontmatter and `docs/05-agent-operations.md` §2. If the task is XL and
   `model_approved` is empty, stop and ask the human which model to use — do not assume.
   State the model you are running as and the effort you will apply.

6. **Set up.** `git status` must be clean. Create the branch named in the frontmatter
   from `main`. Set the task's `status: in_progress` in the file and commit that alone.

7. **Print the working brief** you will follow (so the human can correct it before
   work starts): goal in two sentences · checklist from "Zakres" with the first item being
   the read-of-current-state · acceptance criteria as verified in step 4 · out of scope ·
   STOP gates that apply · verification commands. Then **wait for "go"** if the task has
   `touches_prod: true` or difficulty XL; otherwise proceed.

8. **Work.** Delegate to the subagent named in `agent:` for the implementation when the
   task is M or larger; use `fa-architect` first when it is L/XL and no plan exists in
   "Notatki z realizacji". Keep commits small. Anything noticed outside scope goes to
   `docs/deferred-tasks.md` and nowhere else.

9. **Finish** with the report format from `docs/05-agent-operations.md` §5, pasted into
   "Notatki z realizacji" and into the PR body. Set `status: review`. Do not mark `done`
   — that is the reviewer's call.

Never: start a second task in this session without being told; run `db push`,
`migration repair`, non-SELECT SQL on production, drops, or secret changes without a STOP
message and an explicit yes; print an env value.
