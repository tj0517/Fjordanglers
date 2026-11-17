---
id: FA-M.07
title: Brief dla przewodnika — nocleg, licencje/permity i notatka FA na stronie zlecenia, z jednego Trip Briefu
stage: M
status: in_progress
difficulty: M
model: sonnet
model_approved:
effort: high
agent: fa-admin
branch: feat/fa-m.07-guide-brief
depends_on: [FA-M.04]
blocked_by_questions: []
touches_db: true
touches_prod: false
estimate_h: 6
owner: tj
---

# FA-M.07 — Brief dla przewodnika (one brief)

Rewritten 2026-11-17 (tj, wf-task): the earlier plan (new fields in `inquiries.brief`, read
through `briefSummaryLines`) is replaced by decision (b) below — see "Notatki z realizacji".

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md`
- `docs/05-agent-operations.md` §3, §5, §9 — STOP gates, report format, local stack
- `docs/02-data-model.md`, `docs/audit/rebuild-audit-db-aug-2026.md` — `inquiry_trip_details`
- `src/actions/inquiries.ts` — `TripDetails`, `saveTripDetails`
- `src/app/admin/inquiries/[id]/TripSetupTab.tsx`, `src/app/admin/inquiries/[id]/page.tsx` — Brief tab
- `src/lib/guide-requests/page.ts`, `src/app/r/[token]/page.tsx`, `src/app/r/[token]/request-page.test.tsx`,
  `src/lib/guide-requests/__tests__/request-page.test.ts` — the request page
- `src/lib/inquiries/brief.ts` — `briefSummaryLines` / `guideBriefSummaryLines`; stays unchanged
- `src/lib/events/types.ts`, `src/lib/events/emit.ts`, `src/lib/inquiries/qualified.ts` — events, "update, then emit"
- `docs/design/fa-m-guide-app/README.md`, `docs/design/fa-m-guide-app/Main.dc.html` — approved mockup
  (rows Accommodation, Licence; block "Note from FjordAnglers")
- `docs/tasks/FA-M.04.md` (Notatki z realizacji) — D2/D3
- `src/components/dashboard/TripBriefCard.tsx` — old guide dashboard card, reference only

## Cel
"Too little information about the client" is the top problem in the guide survey. The inquiry
card already has an editable Trip Brief (`inquiry_trip_details`) with accommodation and a note
for the guide, but `/r/[token]` shows only the answers from the public inquiry form, which most
inquiries do not have. After this task there is one brief: the request page shows
accommodation, licences/permits and the FA note from the Trip Brief for every inquiry, the
Trip Brief gains a licences/permits field, and saving it emits an event.

## Zakres
- [ ] Current-state read: `inquiry_trip_details` columns and RLS policies (SELECT only),
  `saveTripDetails`, the Brief tab, what `getGuideRequestPage` selects, the Licence row and
  the note block in the mockup.
- [ ] STOP — licences/permits field as read from the mockup + proposed column(s), tj approves.
- [ ] Migration: licences/permits column(s) on `inquiry_trip_details` — additive, nullable, no
  change to existing columns, rows or policies. Types regenerated.
- [ ] STOP — order of migration and code (§3), tj decides.
- [ ] Trip Brief on the inquiry card: licences/permits in edit and read views; `saveTripDetails`
  validates input with a schema (bounded lengths, allowed values) instead of spreading it.
- [ ] `saveTripDetails` emits `inquiry.brief_updated` (new catalogue entry); payload names the
  changed fields, not their text.
- [ ] Request page: `getGuideRequestPage` reads accommodation, licences/permits and the FA note
  from `inquiry_trip_details`; rows Accommodation and Licence and block "Note from
  FjordAnglers" per the mockup, also without a form brief; nothing rendered for empty values.
- [ ] Tests.

## Gotowe, gdy
- [ ] New column(s) exist locally after `supabase db reset`; policies on `inquiry_trip_details`
  unchanged — **jak sprawdzić:** `information_schema.columns` + `pg_policies`, pasted.
- [ ] `database.types.ts` regenerated in the diff; no `as any`, no new `eslint-disable`.
- [ ] Invalid licences/permits value and over-long text rejected by `saveTripDetails`, nothing
  written — **jak sprawdzić:** test, shown red on the bad input.
- [ ] Non-admin caller of `saveTripDetails` refused — **jak sprawdzić:** test.
- [ ] Saving writes the row and one `inquiry.brief_updated` with the changed field names —
  **jak sprawdzić:** action test + `inquiry_events` read on the local DB, pasted.
- [ ] Request page of an inquiry WITHOUT a form brief shows accommodation, licence and the FA
  note when the Trip Brief has them — **jak sprawdzić:** test.
- [ ] Request page with an empty Trip Brief renders no empty rows or block — **jak sprawdzić:** test.
- [ ] Request page shows no budget line and no `price_range` — **jak sprawdzić:** test that fails
  if either appears.
- [ ] `briefSummaryLines` / `guideBriefSummaryLines` unchanged vs `main`; the FA note does not
  reach the AI agent — **jak sprawdzić:** existing tests green +
  `git diff main -- src/lib/inquiries/brief.ts src/lib/ai` empty.
- [ ] Public inquiry endpoint untouched — `git diff main -- src/app/api/inquiries src/lib/inquiries/brief-schema.ts` empty.
- [ ] `curl` of a local `/r/<token>` returns 200; screenshots of the Brief tab (edit + read) and
  of the request page with and without the note — paths in the PR description.
- [ ] CI `check`, `knip`, `db`, `secrets` green on the head commit — list pasted.

## Poza zakresem
- New fields in `inquiries.brief`, the public inquiry form and its schema (decision (b)).
- Budget, price or guide rate on the request page (decided: none).
- `TripBriefCard` and the guide panel → FA-M.13 (deferred row if the new field belongs there).
- Fixed choices for accommodation, merging `inquiry_trip_details` into `inquiries.brief` → stage 4.
- Sending the request, reminders, WhatsApp → FA-M.05, FA-M.06.
- Any other field or behaviour of `saveTripDetails`, the AI extraction
  (`src/lib/ai/extract-trip.ts`) and the state machine.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
1. Before the migration: licences/permits field from the mockup + proposed column(s).
2. Before the PR: order of migration and code (§3).
3. Before merge: merging to `main` deploys to production — tj merges after the order is settled.

## Weryfikacja
```
pnpm test -- brief
pnpm test -- request-page
pnpm test -- guide-requests
pnpm typecheck && pnpm lint && pnpm knip
git diff main -- src/lib/inquiries/brief.ts src/lib/inquiries/brief-schema.ts src/lib/ai src/app/api/inquiries   # empty
git diff main | grep -n '^+.*eslint-disable'                                                                   # nothing
ls supabase/migrations | tail -3
```
Red proofs: validation test failing on a bad licence value; "no budget on the request page"
test failing when a budget line is added.

## Notatki z realizacji
- **2026-11-17, tj (wf-task):** (b) one brief — the existing Trip Brief (`inquiry_trip_details`) is the source for the request page, only a licences/permits field is added; no new fields in `inquiries.brief`. Money: (a) no budget or price on the request page.
