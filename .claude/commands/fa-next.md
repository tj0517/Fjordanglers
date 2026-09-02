---
description: Show what can be worked on now — todo tasks whose dependencies are done and no open question blocks them
---

Read `docs/tasks/INDEX.md` and every `docs/tasks/FA-*.md`. Output a table of tasks with
`status: todo` whose `depends_on` are all `done` and whose `blocked_by_questions` is
empty, ordered by stage then id, with columns: id · title · difficulty · model ·
estimate_h · agent. Below it, list tasks that are blocked and by what (dependency id or
`O-xx`). Then recommend one task to start and say why in one sentence (deadline
pressure per `docs/REBUILD_PLAN.md` §9 counts). Do not start it.
