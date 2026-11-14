# Guide accounts and `/dashboard` audit — 2026-11-14 (FA-M.02)

Does the guide side of the app work today: sign-up, invite + linking, sign-in, password
reset, sign-out, and every `/dashboard/*` page? The answer sets the scope of FA-M.08
(guide accounts): repair, rebuild or hybrid. No code was changed.

**How it was checked**
- **Code read:** worktree from `origin/main` @ `912e1c4`.
- **Browser walk:** local slim stack after `supabase db reset`. The dev server got the
  local Supabase URL and keys on the command line (`.fa-proofs/fa-m.02/start-dev.sh`,
  untracked), with `RESEND_DEV_FAKE=1` (`/proc/<pid>/environ` showed
  `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421`, `RESEND_DEV_FAKE=1`).
- **Playwright:** screenshots are in `/home/tj/Fjordanglers/.playwright-mcp/fa-m.02/`
  (referred to below by number). Logs are in `/home/tj/Fjordanglers/.fa-proofs/fa-m.02/`
  (untracked).
- **Prod:** read through the `supabase-prod` MCP server, SELECT only, counts and ids only.

**Local setup that differs from a plain reset** (all tj decisions of 2026-11-14,
recorded in the task file):
1. **Prod column grants copied.** Local `authenticated` had no column UPDATE grants on
   `guides`; prod has 33 (§ Prod Q8b). The exact prod set was granted locally, in the
   local DB only. Every step marked **[prod grants]** was walked on that DB.
2. **Invite set by SQL.** `guides.invite_email` on the seeded Hana listing was set with
   local SQL, because both admin forms that set it crash locally (row A3).
3. **Assignment set by SQL.** Inquiry `f2f2…` was assigned to the seeded Jon listing with
   the same `UPDATE` that `assignGuideToInquiry` runs (`src/actions/inquiries.ts:1056-1058`).
   The admin "Guide" tab didn't show for this seed inquiry, and the admin panel is
   outside this audit.
4. **Second invited sign-up needed a delete.** To walk both invited sign-ups with one
   e-mail, the first local account was deleted (`DELETE FROM auth.users …`, local only)
   between them.

---

## 1. Verdict in one paragraph

**Accounts mostly work**: password sign-in, sign-out, session protection, password reset
up to the (faked) send, and admin linking of an *existing* account.

**Getting a guide into the system does not work.**
- The invite path promises "register with this e-mail and you're linked
  automatically". It never links a password sign-up: the autolink lives in
  `/auth/callback`, and only Google sign-in reaches that route.
- An invited guide who picks "I'm a guide" gets a second, empty listing. After that the
  admin can't link them at all (`duplicate key … guides_user_id_unique`).
- Prod agrees: 12 guides have an invite pending, and no linked guide has `invite_email` set (Q1 `linked_and_invite = 0`; neither `/auth/callback` nor `linkGuideAccount` clears the field, so this is a strong proxy — the admin edit form could still have cleared it by hand).

**The MVP's core move fails.** Answering an assignment in ~10 s from a notification needs
a sign-in today. The one-click `?action=accept` is lost on the way through login.
Accepting writes **no event**.

**Little of the panel matches the MVP.** Of the 8 pages, 2 (trips list + trip detail)
and the calendar are MVP. Profile, profile edit and photos are explicitly out of MVP.
The trip page carries an offer form (a guide TODO panel, also out of MVP).

**Usage is low.** Since September guides answered **1 of 15** assignments in the app.
2 of 18 linked guides signed in within 90 days.

---

## 2. Routes and components (code read)

`find src/app/dashboard -name page.tsx | sort` → **8 routes**:

```
src/app/dashboard/account/page.tsx
src/app/dashboard/calendar/page.tsx
src/app/dashboard/page.tsx
src/app/dashboard/photos/page.tsx
src/app/dashboard/profile/edit/page.tsx
src/app/dashboard/profile/page.tsx
src/app/dashboard/trips/[id]/page.tsx
src/app/dashboard/trips/page.tsx
```

| # | Route | Reads (tables) | Writes (actions) | Components | In MVP? |
|---|---|---|---|---|---|
| R1 | `/dashboard` (layout) | `profiles.role` (session), `guides` (session; **auto-INSERTs a `guides` row with the service key** if none) | `acceptGuideTerms` (terms gate) | `DashboardSidenav`, `TermsGate` | layout yes; terms gate — not in MVP list |
| R2 | `/dashboard` (overview) | `guides`, `inquiries`, `inquiry_trip_details.guide_options` (service key) | `signOut` | — | yes (assignments list) |
| R3 | `/dashboard/trips` | `guides`, `inquiries` (service), `experience_pages` via `getInquiryExperiences` | — | — | yes |
| R4 | `/dashboard/trips/[id]` | `guides`, `inquiries`, `inquiry_trip_details` (service) | `respondToAssignment`, `saveGuideOfferEta`, `saveGuideOfferResponse` (+ browser upload to storage `offer-photos`) | `TripAcceptancePanel`, `TripBriefCard`, `GuideTodoList` | accept/decline yes; offer form = "TODO panel", out of MVP |
| R5 | `/dashboard/calendar` | `guides`, `guide_unavailable_dates` (session) | `setAvailability`, `setOpenSeason` | `AvailabilityCalendar` | yes (manual blocks) |
| R6 | `/dashboard/profile` | `guides` (session) | — | — | **out of MVP** (profile) |
| R7 | `/dashboard/profile/edit` | `guides` (session) | `updateGuideProfile` (+ browser upload to storage `guide-photos`) | `ProfileEditForm` | **out of MVP** (profile editing) |
| R8 | `/dashboard/photos` | `guides`, `guide_photos` | `saveGuidePhotos` | `GuidePhotosManager` | **out of MVP** |
| R9 | `/dashboard/account` | `guides` (session), `auth.getUser` | `resetPassword`, `updateGuideProfile` (marketing toggle), `signOut` | `PasswordResetButton`, `MarketingConsentToggle` | partly (password reset yes; no notification settings) |

**Auth surface:**

| Route / action | What it does |
|---|---|
| `/login` | `AuthTabs`: password sign-in + Google OAuth; tab `register` with a role picker (angler default / guide) |
| `/register` | `redirect('/login?tab=register')` |
| `signUp` (`src/actions/auth.ts:50-103`) | `admin.createUser({ email_confirm: true, user_metadata.role })`, sets `profiles.role` = chosen `angler`/`guide`, then `signInWithPassword`. **Never goes through `/auth/callback`.** |
| `/auth/callback` (`route.ts:22-98`) | PKCE code exchange; ensures a profile row; **autolink by `guides.invite_email`**; role redirect. Its only caller is `GoogleAuthButton` (`signInWithOAuth`, `google-auth-button.tsx:17-20`). |
| `/forgot-password` → `resetPassword` | `admin.generateLink('recovery')`, custom URL `/auth/reset?token_hash=…`, `sendPasswordResetEmail` → `sendEmail()` (honours `RESEND_DEV_FAKE`) |
| `/auth/reset` → `/reset-password` → `updatePassword` | `verifyOtp(token_hash)` then `updateUser({password})` |
| `linkGuideAccount` (`src/actions/admin.ts:337-394`) | `requireAdmin()`; finds an auth user by UUID or by e-mail (`listUsers({ perPage: 1000 })` scan); sets `guides.user_id`, `profiles.role='guide'` |
| Sign-in by e-mail link | **not implemented**: `grep -rnE "signInWithOtp|magiclink" src` → no hits. `/auth/callback`'s header comment lists magic links as "(future)". |

**Dead code (knip + callers).** `pnpm knip` exits 0 with no findings. Every guide-facing
export has a caller:

```
signIn -> src/components/auth/auth-tabs.tsx
signUp -> src/components/auth/auth-tabs.tsx
signOut -> admin/sidenav, layout/nav, dashboard/page, dashboard/account/page, supabase/middleware
updatePassword -> src/components/auth/reset-password-form.tsx
resetPassword -> forgot-password-form.tsx, dashboard/account/AccountActions.tsx
acceptGuideTerms -> components/dashboard/terms-gate.tsx
updateGuideProfile -> profile-edit-form.tsx, account/MarketingConsentToggle.tsx
setOpenSeason / setAvailability -> components/dashboard/availability-calendar.tsx
respondToAssignment / saveGuideOfferEta -> dashboard/trips/[id]/TripAcceptancePanel.tsx
saveGuideOfferResponse -> components/dashboard/GuideTodoList.tsx
saveGuidePhotos -> components/dashboard/GuidePhotosManager.tsx
```

So nothing is *technically* dead. What is dead **for the MVP** is R6, R7, R8 and the
offer form on R4. Whether to delete them is FA-M.08's call.

**Rule violations found on the way** (not fixed here):
- **Rule 3, data access only in the data layer.** All 8 pages and the layout call
  `.from(...)` directly (`grep -E "\.from\(" src/app/dashboard -r` hits every
  `page.tsx` + `layout.tsx`). This is wider than the FA-1.93 row, which named only the
  layout.
- **Rule 5, every state change emits an event.**
  - `respondToAssignment` (`src/actions/inquiries.ts:1227-1265`) updates
    `guide_acceptance` and emits nothing (`emitEvent` is used in that file only at l. 763).
  - Shown on the local DB: after the guide's Accept, `inquiry_events` for inquiry `f2f2…`
    = **0 rows**, while `guide_acceptance = accepted` (`.fa-proofs/fa-m.02/accept-no-event.log`).

---

## 3. Dependencies on things slated for removal

Target schema: `docs/02-data-model.md` l. 277-280 and l. 330-334.

| Dependency | Where | Fate per data model |
|---|---|---|
| `guides.stripe_account_id`, `stripe_payouts_enabled`, `stripe_charges_enabled` (Stripe Connect) | `dashboard/layout.tsx:45,67-68,71,79`; the **auto-insert of a new `guides` row writes them** | dropped (`guides … minus stripe_*`) |
| `guides.iban` | `dashboard/layout.tsx:45,71,79` (selected, unused in render) | dropped (`minus iban*`) |
| `guides.pricing_model = 'commission'`, `is_beta_listing` | layout auto-insert; `/auth/callback:70`; `linkGuideAccount` | marketplace leftovers |
| `inquiry_trip_details` (`guide_options`, brief fields) | R2, R4, `GuideTodoList`, `saveGuideOfferResponse` | dropped → `inquiries.brief` (stage 4) |
| `guide_unavailable_dates` | R5, `availability.ts` | replaced by `guide_blocked_dates` ranges (stage 4) |
| `experience_pages`, `inquiries.trip_id` / `experience_page_id` | R3 via `src/lib/inquiries/experience-lookup.ts:84,99,138` | renamed `experience_pages → experiences` (stage 4) |
| Legacy `experiences` table, `requests` / `request_guides` (marketplace) | none found on the guide surface (`grep -rnE "from\('experiences|requests|request_guides" src/app/dashboard src/components/dashboard src/actions/{dashboard,availability,auth}.ts src/app/auth` → no hits) | — |

The admin guide page still shows a "STRIPE CONNECT" block and a "Payouts" button
(screenshot 04). That's admin, out of scope here.

---

## 4. Flows walked in the browser

Status values: **works** / **error** (exact message) / **dead** / **not implemented** /
**local artifact** (fails only because of the local env; reason given).

| # | Flow | Status | Evidence |
|---|---|---|---|
| F1 | Guide sign-up (self, "I'm a guide") | **works — too easily.** Anyone gets role `guide`, a new `guides` row (`status pending`, `country ''`, `pricing_model commission`, `stripe_charges_enabled f`) and the dashboard at once. E-mail counts as confirmed with no check. | 05, 06, 07; `db-after-self-register.log`: `91c1e027… | Jon Selfreg | pending | t | commission | f | guide | t` |
| F2 | Register tab default role | **angler** is preselected; the invite link (`/login?tab=register`) doesn't change that | 05; button text `Create angler account` |
| F3 | Admin invite: set `invite_email` (`/admin/guides/new`, `/admin/guides/[id]/edit`) | **local artifact** — both crash: `Invalid src prop (http://127.0.0.1:54421/storage/v1/object/public/landscapes/norge-1.jpg) on next/image, hostname "127.0.0.1" is not configured`. With prod config the landscape URLs are on `*.supabase.co`, which `next.config.ts` allows (`remotePatterns` l. 25/31) | 03; `dev.log` l. 20/27 |
| F4 | Admin "Copy invite link" | **works** — copies `/login?tab=register` (`copy-invite-link.tsx:19`). The link carries no token and no e-mail. | 04 |
| F5 | Invited guide signs up as **angler** (default) with the invite e-mail | **error (silent)** — lands on `/`; role `angler`; listing **not linked**; `/dashboard` → `/` | 10; `invite-variant1-angler.log`: `hana.guide@seed.test | angler | 0` and `Hana Seed | hana.guide@seed.test | f` |
| F6 | Same guide retries as **guide** | **error** — `An account with this email already exists.` | 11 |
| F7 | Invited guide signs up as **guide** with the invite e-mail | **error** — gets a second, empty listing; the invited listing stays unlinked | 12; `invite-variant2-guide.log`: `Hana Seed … | f` / `Hana Invited | pending | | t` |
| F8 | Autolink on `invite_email` (`/auth/callback`) | **dead for password sign-up** (route never reached). Reachable only by Google sign-in, which can't be walked locally: `{"code":400,"error_code":"validation_failed","msg":"Unsupported provider: provider is not enabled"}` | 02; code §2 |
| F9 | Admin "Link account" (invite button) on the listing after F7 | **error** — `duplicate key value violates unique constraint "guides_user_id_unique"`, shown raw. The page still says `Invite email: hana.guide@seed.test — waiting for registration` | 14 |
| F10 | Admin "Link account" (by e-mail) to a self-registered guide (F1) | **error** — same `duplicate key … guides_user_id_unique` | 09 |
| F11 | Admin "Link account" (by e-mail) to an **angler** account | **works** — `Jon Seed | f | guide | jon.real@seed.test` | 15; `link-happy-path.log` |
| F12 | Password sign-in (admin, guide) | **works**; wrong password → `Incorrect email or password. Please try again.` | URL `/admin` after submit; 31 |
| F13 | Sign-in by e-mail link | **not implemented** — login page offers Google + password only; no `signInWithOtp` in code | 01 |
| F14 | Password reset, signed out (`/forgot-password`) | **works up to the faked send** — UI `If an account exists for …, you will receive a password reset link shortly.`; log `[email] RESEND_DEV_FAKE=1 — not sent: type=PasswordResetEmail to=j***@seed.test`; `grep -c "token_hash\|/auth/reset?" dev.log` → `0` (no link logged). Not walked further (task scope). | 30; `dev.log` |
| F15 | Password reset from `/dashboard/account` **[prod grants]** | **works up to the faked send** — `Reset link sent — check your inbox ✓` + the same log line | 29 |
| F16 | Reset link invalid / `/reset-password` without session | **works** — both → `/forgot-password?error=invalid_link`, `This reset link is invalid or has expired.` | 32, 33 |
| F17 | Sign-out (admin sidebar, guide dashboard) | **works** — → `/login`; `/admin` and `/dashboard` afterwards → `/login?next=…` | URLs in the walk log |
| F18 | Signed out → any `/dashboard/*` | **works** — proxy → `/login?next=<path>` | URL `/login?next=%2Fdashboard` |
| F19 | Angler → `/dashboard` | **works** — layout → `/` | F5 |
| F20 | Terms gate on first dashboard visit (plain local reset) | **error (local)** — `permission denied for table guides` (`[acceptGuideTerms] permission denied for table guides`); the gate never closes. **Local only**: prod has the column grants (Q8b) and last accepted 2026-11-03 (Q7). Deferred row added. | 08; `dev.log` |
| F21 | Terms gate **[prod grants]** | **works** — `terms_accepted_at` set | 13; DB `Hana Invited|t|f` |
| F22 | Terms modal covers the whole dashboard **including Log out** | **product finding** — a guide who won't accept can't sign out from the UI (Playwright: `<div class="fixed inset-0 z-[200] …"> intercepts pointer events`) | 08 |
| F23 | Assignment e-mail link `…/dashboard/trips/<id>?action=accept`, signed out | **error** — sign-in required (MVP says links work without sign-in). The proxy keeps only the path in `next` → `/login?action=accept&next=%2Fdashboard%2Ftrips%2F<id>`, so after sign-in the guide reaches the trip **without** `action=accept`: one-click accept does not fire | 16, 17; redirect chain below |
| F24 | Same flow, first attempt | **observed once, not reproduced** — at ~**10:16:44 UTC** (console offset 152 780 ms from 10:14:11) sign-in landed on `/` instead of the trip; dev log `GET /dashboard/trips/f2f2… 307 in 1894ms (compile: 1514ms …)`. Second attempt reached the trip. A Fast Refresh rebuild is logged at the same moment, so a dev-only cause is possible. | 16; console log L61-69; `dev.log` |
| F25 | Accept an assignment **[prod grants]** | **works**; **no event** (`inquiry_events` 0 rows for the inquiry) | 18; `accept-no-event.log` |

Redirect chain for F23 (second attempt):

```
307 /dashboard/trips/f2f2…?action=accept -> /login?action=accept&next=%2Fdashboard%2Ftrips%2Ff2f2…
200 /login?action=accept&next=%2Fdashboard%2Ftrips%2Ff2f2…
200 /dashboard/trips/f2f2…            ← action=accept dropped
```

**Every `/dashboard/*` page as a guide** (Jon Seed listing linked to `jon.real@seed.test`,
**[prod grants]**). Route count from `find` = 8; rows below = 8 (plus the layout, R1).

| Route | Status | Evidence |
|---|---|---|
| `/dashboard` | **works** — 200, `Good morning, Jon.`, `ACTIVE`, trip `Gunnar Weekly` | 20 |
| `/dashboard/trips` | **works** — 200, list with the assigned inquiry | 21 |
| `/dashboard/trips/[id]` | **works** — 200; Accept/Decline, ETA, offer form | 17, 18, 22 |
| `/dashboard/calendar` | **works** — blocking 20 Nov saves `guide_unavailable_dates (9c9c…03, 2026-11-20)` | 23, 28; `calendar-block.log` |
| `/dashboard/profile` | **works** — 200 | 24 |
| `/dashboard/profile/edit` | **local artifact** — `Application error: a client-side exception`; same `next/image` host error as F3 (`LANDSCAPE_LIBRARY` is built from `NEXT_PUBLIC_SUPABASE_URL`) | 25; console log |
| `/dashboard/photos` | **works (page load)**; uploads not walked (`storage-api` is excluded from the slim stack) | 26 |
| `/dashboard/account` | **works** — reset button (F15); marketing toggle `aria-checked true → false`, DB `photo_marketing_consent = f` | 27, 29 |

---

## 5. FA-1.93 deferred risks: confirmed or not

| Risk (`docs/deferred-tasks.md`) | Verdict | Evidence |
|---|---|---|
| Unverified sign-up e-mail + autolink on `invite_email` (l. 366) | **Confirmed, with a correction.** E-mail is never verified (F1: `email_confirmed t` right after sign-up; prod: `auth users with unconfirmed email = 0`). Blocking scenario confirmed: whoever registers an invite e-mail first owns it (F6). **Correction:** the `/auth/callback` autolink can't be reached by password sign-up (F8). But admin `linkGuideAccount`, by stored `invite_email` or typed e-mail, attaches **whatever account holds that address** with no proof of ownership (F11 links an account the admin never verified). So the "stranger gets the listing" path goes through the admin button, not the callback. | F1, F6, F8, F11; Q5 |
| `profiles` world-readable (l. 367) | **Confirmed** on prod | Q5: policy `Public reads all profiles roles={public} using=true`; `anon has SELECT on profiles = true` |
| `/auth/callback` role redirect is a no-op (l. 368) | **Confirmed by code**; not walkable locally (Google disabled). The callback does run in prod: 7 Google identities. | `route.ts:26` `next = explicitNext ?? '/dashboard'`, `:89` `destination = (explicitNext == null && role === 'guide') ? '/dashboard' : next`; Q5 `google=7, email=28` |
| `.from('profiles')` in layouts (l. 369) | **Confirmed, and wider**: `dashboard/layout.tsx:27-31`, plus every dashboard `page.tsx` queries directly (§2) | code |
| 5 `auth.users` without `profiles` (l. 365) | **Confirmed**, still 5 | Q5 `auth.users without profiles = 5` |

**New risks found by this audit:**
- **Self-registered guides.** Anyone can become a guide with a dashboard and a pending
  listing (F1). FA-1.93 deferred the "guide" choice in the form to the account rebuild.
  Prod: 2 listings have exactly the auto-insert shape (`country ''`, `pending`, created
  months after their accounts): `0ccf4edb…`, `1112c9ae…`. Also 6 `profiles` have
  `role=guide` and no `guides` row; each would get a fresh empty listing on its next
  dashboard visit.
- **Invite e-mails aren't unique.** No unique index on `guides.invite_email`, and one
  value is shared by two guides in prod (Q6). The callback lookup uses `.maybeSingle()`,
  which returns an error on 2 rows, so that address can never autolink.
- **`linkGuideAccount` misses users past 1 000.** It scans `listUsers({ perPage: 1000 })`,
  so once there are more than 1 000 auth users it silently can't find an e-mail
  (`admin.ts:369`).

---

## 6. Prod (supabase-prod MCP, SELECT only, 2026-11-14)

**Q1 — guides: linking, invites, sign-in recency**
```sql
SELECT count(*) AS guides_total,
  count(*) FILTER (WHERE g.user_id IS NOT NULL) AS with_user_id,
  count(*) FILTER (WHERE nullif(trim(g.invite_email),'') IS NOT NULL) AS with_invite_email,
  count(*) FILTER (WHERE g.user_id IS NOT NULL AND nullif(trim(g.invite_email),'') IS NOT NULL) AS linked_and_invite,
  count(*) FILTER (WHERE g.user_id IS NULL AND nullif(trim(g.invite_email),'') IS NOT NULL) AS invite_not_linked,
  count(*) FILTER (WHERE g.user_id IS NULL AND nullif(trim(g.invite_email),'') IS NULL) AS neither,
  count(*) FILTER (WHERE g.user_id IS NOT NULL AND u.last_sign_in_at >= now() - interval '90 days') AS linked_signed_in_90d,
  count(*) FILTER (WHERE g.user_id IS NOT NULL AND u.last_sign_in_at IS NULL) AS linked_never_signed_in,
  count(*) FILTER (WHERE g.terms_accepted_at IS NOT NULL) AS terms_accepted
FROM public.guides g LEFT JOIN auth.users u ON u.id = g.user_id;
```
| guides_total | with_user_id | with_invite_email | linked_and_invite | invite_not_linked | neither | linked_signed_in_90d | linked_never_signed_in | terms_accepted |
|---|---|---|---|---|---|---|---|---|
| 33 | 18 | 12 | 0 | 12 | 3 | 2 | 0 | 15 |

**Q3 — session activity of linked guides** (`last_sign_in_at` misses refreshed sessions)
```sql
SELECT count(DISTINCT g.id) AS linked_guides,
  count(DISTINCT g.id) FILTER (WHERE u.last_sign_in_at >= now() - interval '90 days') AS sign_in_90d,
  count(DISTINCT g.id) FILTER (WHERE s.updated_at >= now() - interval '90 days') AS session_activity_90d,
  count(DISTINCT g.id) FILTER (WHERE s.updated_at >= now() - interval '30 days') AS session_activity_30d,
  count(DISTINCT g.id) FILTER (WHERE s.user_id IS NOT NULL) AS has_any_session_row
FROM public.guides g JOIN auth.users u ON u.id = g.user_id LEFT JOIN auth.sessions s ON s.user_id = g.user_id;
```
| linked_guides | sign_in_90d | session_activity_90d | session_activity_30d | has_any_session_row |
|---|---|---|---|---|
| 18 | 2 | 7 | 2 | 17 |

**Q2 — `guide_unavailable_dates` per guide** (from the per-guide query; ids only)
```sql
SELECT g.id AS guide_id, (SELECT count(*) FROM public.guide_unavailable_dates d WHERE d.guide_id = g.id) AS unavailable_rows
FROM public.guides g;   -- excerpt of the full per-guide query, which also returned link / sign-in / assignment columns
```
| guide_id | unavailable_rows |
|---|---|
| `8779da8a-2e77-4f3b-83af-14f5a4a55b5e` | 265 |
| `64802cf6-db00-4712-878e-19c7250511eb` | 62 |
| all other 31 guides | 0 |

Linked guides by last sign-in (same query): 2026-10-13, 2026-08-20, 2026-07-26 (the only
`email,google` account; 21 assignments), 2026-07-11, 2026-07-10, 2026-06-27, then 12 in
March–April 2026.

**Q4 — are assignments answered in the app?** (`guide_responded_at` is written only by
`respondToAssignment`; `assignGuideSilently` sets `guide_acceptance='accepted'` without it)
```sql
SELECT date_trunc('month', q.assigned_at)::date AS month, (g.user_id IS NOT NULL) AS guide_linked,
  count(*) AS assignments,
  count(*) FILTER (WHERE q.guide_responded_at IS NOT NULL) AS answered_in_app,
  count(*) FILTER (WHERE q.guide_acceptance IS NOT NULL AND q.guide_responded_at IS NULL) AS accepted_without_app,
  count(*) FILTER (WHERE q.guide_acceptance IS NULL) AS no_answer
FROM public.inquiries q JOIN public.guides g ON g.id = q.assigned_guide_id GROUP BY 1, 2 ORDER BY 1, 2;
```
| month | guide_linked | assignments | answered_in_app | accepted_without_app | no_answer |
|---|---|---|---|---|---|
| 2026-07 | t | 19 | 7 | 11 | 1 |
| 2026-08 | t | 9 | 9 | 0 | 1 |
| 2026-09 | f | 8 | 0 | 8 | 0 |
| 2026-09 | t | 2 | 0 | 2 | 0 |
| 2026-10 | f | 2 | 0 | 2 | 0 |
| 2026-10 | t | 2 | 1 | 1 | 0 |
| 2026-11 | f | 1 | 0 | 1 | 0 |

Since 2026-09: 15 assignments, **1** answered in the app, 11 to unlinked guides. (2026-08
sums to 10 against 9: one row has `guide_responded_at` set and `guide_acceptance` empty.
The cause wasn't established. `unassignGuide` also clears `assigned_guide_id`, so it
doesn't explain that row.)

**Q5 — risk checks**
```sql
-- guides.user_id unique index; invite_email unique index; profiles SELECT policies; anon SELECT on profiles;
-- auth.users without profiles; users with >1 guides row; rows shaped like the layout auto-insert;
-- profiles role=guide without guides row; linked guide with non-guide role; unlinked invite_email = existing user;
-- identities by provider; unconfirmed e-mails   (full text in the PR description)
```
| check | result |
|---|---|
| guides.user_id unique | `CREATE UNIQUE INDEX guides_user_id_unique ON public.guides USING btree (user_id) WHERE (user_id IS NOT NULL)` |
| guides.invite_email unique | NONE |
| profiles SELECT policies | `Public reads all profiles roles={public} using=true` |
| anon has SELECT on profiles | true |
| auth.users without profiles | 5 |
| users with >1 guides row | 0 |
| guides rows shaped like layout auto-insert (country blank, pending) | 2 |
| profiles role=guide without a guides row | 6 |
| linked guides whose profile role is not guide | 0 |
| unlinked invite_email equal to an existing auth.users e-mail | 0 |
| auth identities by provider | google=7, email=28 |
| auth users with unconfirmed e-mail | 0 |

**Q6 — invite e-mails shared by >1 guide**
```sql
SELECT count(*) FROM (SELECT lower(trim(invite_email)) e FROM public.guides
  WHERE nullif(trim(invite_email),'') IS NOT NULL GROUP BY 1 HAVING count(*) > 1) x;
```
→ `1`

**Q7 — can a signed-in guide update its own row?**
```sql
SELECT has_table_privilege('authenticated','public.guides','UPDATE') AS authenticated_table_update,
  has_column_privilege('authenticated','public.guides','terms_accepted_at','UPDATE') AS col_terms_accepted_at,
  has_column_privilege('authenticated','public.guides','bio','UPDATE') AS col_bio,
  has_column_privilege('authenticated','public.guides','photo_marketing_consent','UPDATE') AS col_marketing_consent,
  (SELECT max(terms_accepted_at)::date FROM public.guides) AS last_terms_acceptance,
  (SELECT count(*) FROM public.guides WHERE terms_accepted_at >= '2026-09-04') AS terms_accepted_since_baseline,
  (SELECT count(*) FROM public.guides WHERE user_id IS NOT NULL AND terms_accepted_at IS NULL) AS linked_guides_without_terms,
  (SELECT max(updated_at)::date FROM public.guides) AS last_guides_update_any;
```
| table_update | col_terms | col_bio | col_marketing | last_terms_acceptance | since_baseline | linked_without_terms | last_update |
|---|---|---|---|---|---|---|---|
| false | true | true | true | 2026-11-03 | 1 | 3 | 2026-11-10 |

**Q8b — column ACLs of `authenticated` on `guides`**, prod vs local. `information_schema.column_privileges`
returns no rows to the MCP role (Q8), so this reads the catalog:
```sql
SELECT a.privilege_type, string_agg(c.attname, ', ' ORDER BY c.attname) AS columns, count(*) AS n
FROM pg_attribute c CROSS JOIN LATERAL aclexplode(c.attacl) a
WHERE c.attrelid='public.guides'::regclass AND c.attnum>0 AND NOT c.attisdropped AND a.grantee='authenticated'::regrole
GROUP BY a.privilege_type
UNION ALL
SELECT 'TABLE:'||string_agg(a.privilege_type, ',' ORDER BY a.privilege_type), '-', count(*)
FROM pg_class t CROSS JOIN LATERAL aclexplode(t.relacl) a
WHERE t.oid='public.guides'::regclass AND a.grantee='authenticated'::regrole ORDER BY 1;
```
| | prod | local after `db reset` |
|---|---|---|
| column SELECT | 42 columns | 42 columns (same set) |
| column UPDATE | **33**: accepted_payment_methods, avatar_url, bio, boat_capacity, boat_engine, boat_length_m, boat_name, boat_type, calendar_disabled, calendar_mode, cancellation_policy, certifications, city, country, cover_url, default_balance_payment_method, facebook_url, fish_expertise, full_name, iban, iban_bank_name, iban_bic, iban_holder_name, instagram_url, landscape_url, languages, photo_marketing_consent, specialties, tagline, terms_accepted_at, website_url, years_experience, youtube_url | **0** |
| table | MAINTAIN, SELECT, TRIGGER, TRUNCATE | MAINTAIN, SELECT, TRIGGER, TRUNCATE |

After the local `GRANT UPDATE (<the 33>) … TO authenticated`: `SELECT 42 / UPDATE 33`
(`local-guides-acl-after-prod-grants.log`).

**Q9 — use of the trip-page offer form** (`inquiry_trip_details.guide_options`, written by `saveGuideOfferResponse`)
```sql
SELECT count(*) AS trip_details_rows,
  count(*) FILTER (WHERE jsonb_typeof(guide_options)='array' AND jsonb_array_length(guide_options)>0) AS with_guide_options,
  count(*) FILTER (WHERE jsonb_typeof(guide_options)='array' AND jsonb_array_length(guide_options)>0 AND updated_at >= '2026-09-01') AS since_sep,
  max(updated_at) FILTER (WHERE jsonb_typeof(guide_options)='array' AND jsonb_array_length(guide_options)>0)::date AS last_use
FROM public.inquiry_trip_details;
```
| trip_details_rows | with_guide_options | since_sep | last_use |
|---|---|---|---|
| 41 | 9 | 0 | 2026-08-27 |

---

## 7. Against the MVP needs (function 5 "Guide accounts" + scope notes)

| MVP need | Today |
|---|---|
| Sign-in | ✅ password (F12); Google exists but isn't walkable locally |
| Password reset | ✅ up to the send (F14–F16); the link-click half not walked (task scope) |
| Sessions | ✅ sign-out, protected routes (F17, F18) |
| Notification settings | ❌ none (no such UI; `grep` for notification/push settings in dashboard → none) |
| Tied to `guides.user_id` | ✅ for linked guides; ❌ getting there (F5–F10) |
| `/dashboard` = assignments list + calendar preview | ◐ list yes (R2/R3); calendar is a separate page, no preview on overview |
| Guide sees assignments + status | ✅ (R2 states: awaiting response / create offer / offer sent / confirmed) |
| WhatsApp/notification links work **without signing in** | ❌ login wall (F23); one-click accept lost |
| Answer in ~10 s from a notification | ❌ not with a login wall; in prod 1 of 15 answered in app since Sept |
| Guides never operate or maintain anything | ❌ terms gate (F22), profile/photo upkeep prompts, offer form on R4 |
| Calendars stay with the guide (Google/Apple ICS, read-only) | ❌ not implemented (no ICS code) |
| Manual blocks in `/dashboard/calendar` | ✅ (R5, screenshot 28); used by 2 guides in prod (Q2) |
| Out of MVP: profile editing, billing, TODO panel, native app, writing to calendar | present: profile (R6), profile edit (R7), photos (R8), offer form "TODO" (R4) |
| PWA install | ❌ no manifest / service worker |
| Existing guides invited via `invite_email` | ❌ broken (F5–F9); 12 pending in prod; no linked guide has `invite_email` set (Q1 `linked_and_invite = 0`; neither `/auth/callback` nor `linkGuideAccount` clears the field, so this is a strong proxy — the admin edit form could still have cleared it by hand) |

---

## 8. Options for FA-M.08

All three keep Supabase Auth and the 18 existing linked accounts (`auth.users`, `guides.user_id`).
They differ in what happens to the invite, the assignment link and the 8 pages. Sizes are
relative effort for one agent + tj's reviews, not hours.

### Option A — Repair (L)
- **What it is:** keep every page and flow, fix what's broken in place.
  - Invite links by e-mail at password sign-up too, and sign-up no longer offers "guide".
  - Linking survives a pre-existing empty listing, and the unique-index clash is handled.
  - `respondToAssignment` emits an event.
  - The accept link survives login.
  - The terms modal lets you sign out.
  - Pages move to the data layer.
- **What a guide sees:** the same 6-item navigation as today (Overview, Calendar, Profile,
  Photos, My Trips, Settings). The invite now works. Notification links still ask for a
  sign-in first.
- **Risks:**
  - If the MVP's "links work without signing in" stays a requirement, a repair doesn't
    meet it. That's discovered at FA-M.13 acceptance.
  - Repairing R6–R8 and the offer form costs work on pages the MVP excludes, and they
    carry the stage-4 removals (`inquiry_trip_details`, `guide_unavailable_dates`,
    `stripe_*`) into a second migration later.
- **Cost:** L. Every page gets touched (rule 3) though half are out of MVP. Debt left:
  out-of-MVP pages kept alive.
- **MVP check:** sign-in ✅ · reset ✅ · invite ✅ · links without sign-in ❌ · ~10 s answer ❌ · guide maintains nothing ❌.

### Option B — Rebuild (XL)
- **What it is:** a new guide module.
  - Admin issues an **invite token**: a link with a one-time code. The guide sets a
    password or signs in by e-mail link, and the listing is bound by the token, not by
    an e-mail match.
  - Each assignment gets a **signed link** that opens the assignment and lets the guide
    accept/decline with no sign-in (the `requireToken` pattern already used for offers
    and reviews).
  - A new `/dashboard` with the assignments list and a calendar preview, built PWA-ready.
  - All 8 current pages, the self-sign-up-as-guide path, the layout auto-insert and the
    `/auth/callback` autolink are deleted.
- **What a guide sees:** one tap from WhatsApp → the assignment → Accept. Signed in, a
  short list of assignments and a calendar. No profile, photos or offer form. Existing
  linked guides keep their login.
- **Risks:**
  - The XL size against "start no later than 2026-12-01": if FA-M.08 slips, FA-M.12
    (PWA/push) and FA-M.13 slip with it. That shows at the first review of the invite
    token piece.
  - Deleting `/dashboard/calendar` would take manual blocks away from the 2 guides who
    use them (265 and 62 rows) until the new calendar ships. Discovered if they log in
    in between.
  - Signed links are a new kind of credential: a forwarded WhatsApp message lets someone
    else accept. Expiry and a scope of one assignment, one action are needed.
- **Cost:** XL. Leaves the least debt; nothing on the guide side depends on stage-4
  removals.
- **MVP check:** all ✅ except ICS (separate tasks FA-M.09/M.10) and notifications (FA-M.12).

### Option C — Hybrid (M)
- **Keep what works:** Supabase Auth sign-in, sign-out, password reset,
  `/dashboard/calendar`, `/dashboard/trips` + `[id]` Accept/Decline.
- **Rebuild what's broken:** the invite path (token-bound, not e-mail matching) and the
  assignment link (signed, works without sign-in, accept lands as one tap). Add the
  missing event.
- **Delete from guide navigation (and code):** Profile, Profile edit, Photos, the offer
  form on the trip page, the self-sign-up-as-guide option, the layout auto-insert with
  its Stripe columns.
- **What a guide sees:** a three-item navigation (Assignments, Calendar, Settings). One
  tap from a notification to answer. Existing guides keep their login and calendar
  blocks.
- **Risks:**
  - The kept pages still query directly (rule 3). If FA-M.08 doesn't move them into the
    data layer, the stage-2 move inherits it.
  - Deleting the offer form changes how guides send offer details today. Q9: 9 of 41
    trip-detail rows ever had offer-form options, 0 since 2026-09-01, last use 2026-08-27.
    If a guide relied on it, FA hears it from that guide.
  - The signed-link credential risk is the same as in B.
- **Cost:** M. Debt: R2/R3/R5 still read `inquiry_trip_details` / `guide_unavailable_dates`
  until stage 4.
- **MVP check:** sign-in ✅ · reset ✅ · sessions ✅ · invite ✅ · links without sign-in ✅
  · ~10 s answer ✅ · guide maintains nothing ✅ · calendar preview on overview ◐ (add
  or leave to FA-M.13) · ICS ❌ (FA-M.09/M.10) · notification settings ❌ (FA-M.12).

**Recommendation (for tj to decide in FA-M.08): C.**
- **Why:** the parts that work (auth, reset, calendar, accept) are exactly the MVP core.
  The parts that are broken (invite, link-without-sign-in) are the ones that have to be
  built differently anyway. The rest is out of MVP and is cheaper to delete than to
  repair.
- **When B is better:** if the guide app is meant to be a separate PWA shell from day one
  (FA-M.12 decides the shell).
- **When A is better:** never against this MVP list. Only if the profile and photo pages
  must stay for guides who aren't in the MVP flow.

---

## 9. Local-environment findings (not product)

- **Column grants.** `supabase db reset` doesn't reproduce prod's column UPDATE grants on
  `guides`. `baseline_prod.sql` l. 9304/9497/9522 declares them, and no later migration
  revokes them (grep over all post-baseline migrations). The cause wasn't found. The CI
  `db` job is affected the same way. Deferred row added.
- **Image host.** `next/image` rejects `127.0.0.1` local storage URLs. This crashes
  `/admin/guides/new`, `/admin/guides/[id]/edit` and `/dashboard/profile/edit` locally.
- **Google sign-in.** The local stack has no Google provider, so F8 and the callback
  can't be walked locally.

## 10. Incident during the walk — Ads hits from localhost

- **What happened:** the Playwright Ads block held from 08:25 (11 requests
  `ERR_BLOCKED_BY_CLIENT`). The browser context was recreated around 10:14:11 UTC and
  lost the block.
- **What was sent:** between 10:14:11 and 10:20:10 UTC, **33 `page_view` hits** went to
  `AW-18171634204` (`pagead2.googlesyndication.com/ccm/collect`), plus 37
  `googletagmanager.com/gtag/js` loads and 5 `googletagmanager.com/a` pings. All carried
  `dl=http://localhost:3000/…`.
- **What was not sent:** **0 conversions**, **0 GA4** requests (`google-analytics.com`,
  `/g/collect`, `region1`, any `G-` id → no hits). No inquiry was submitted.
- **Proof:** `.fa-proofs/fa-m.02/ads-requests-sent.txt`.
- **Follow-up:** tj decision 2026-11-14 — leave the hits, add a deferred row (tags only
  on the production host, before FA-M.04).

## 11. Screenshots

`/home/tj/Fjordanglers/.playwright-mcp/fa-m.02/`:
`01-login-page-no-email-link.png` · `02-google-signin-local-provider-disabled.png` ·
`03-admin-guide-new-crash-local-image-host.png` · `04-admin-guide-detail-invite-and-link-buttons.png` ·
`05-register-tab-default-angler.png` · `06-register-as-guide-filled.png` ·
`07-self-registered-guide-dashboard-terms-gate.png` · `08-terms-gate-blocks-logout.png` ·
`09-admin-link-to-self-registered-guide-error.png` · `10-invite-signup-default-angler-lands-home.png` ·
`11-invite-resignup-as-guide-already-exists.png` · `12-invite-signup-as-guide-gets-empty-listing.png` ·
`13-terms-gate-accepted-with-prod-grants.png` · `14-admin-invite-link-button-duplicate-key.png` ·
`15-admin-link-existing-angler-account-works.png` · `16-accept-link-signed-out-asks-login.png` ·
`17-trip-detail-after-login-accept-param-lost.png` · `18-trip-accepted-by-guide.png` ·
`20-dashboard-overview.png` · `21-dashboard-trips.png` · `22-dashboard-trip-detail.png` ·
`23-dashboard-calendar.png` · `24-dashboard-profile.png` · `25-dashboard-profile-edit.png` ·
`26-dashboard-photos.png` · `27-dashboard-account.png` · `28-calendar-day-blocked.png` ·
`29-account-send-reset-email.png` · `30-forgot-password-sent.png` · `31-login-wrong-password.png` ·
`32-reset-invalid-link.png` · `33-reset-password-no-session.png`

The screenshots show local seed accounts only (`*@seed.test`). Password fields are masked;
no reset link or token appears in any screenshot or log.
