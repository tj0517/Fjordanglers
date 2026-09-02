# Database ↔ Code Cross-Reference Audit — FjordAnglers repo (2026-08-31)

Sources: `src/lib/supabase/database.types.ts` (regenerated 2026-05-28, STALE), `supabase/migrations/*.sql` (60 files, 2026-04-10 → 2026-08-27), `src/` (292 TS/TSX files), `whatsapp-bridge/*.mjs`. No direct DB access — row counts / null-rates still to be collected (see SQL script in plan doc).

## 0. Method & caveats

- Two calling conventions: `.from('x')` for tables in the types file; `(supabase.from as any)('x')` for every table added after 2026-05-28 (`src/actions/ads.ts`, `src/actions/finances.ts`, `src/actions/inquiries.ts:757`, `src/app/admin/{finances,pipeline,ads}/page.tsx`).
- Read/write split is heuristic. Column usage = word-boundary grep; zero-hit lists are reliable, "present" verdicts for generic names are not; second pass restricted to files that query the table.
- **Two tables exist in neither migrations nor types** but are queried by live code: `inquiry_trip_details` and `guide_unavailable_dates` (dashboard-created). Call sites wrap them in try/catch "Table not yet migrated — graceful fallback" (`src/actions/inquiries.ts:1055`, `src/app/admin/inquiries/[id]/page.tsx:285`).

## (a) Table classification

| Table | Cols | Class | R / W | Files | Notes |
|---|---|---|---|---|---|
| guides | 57 | CORE | 67/19 | 36 files (actions/*, admin/**, dashboard/**, experiences/[slug], auth/callback, sitemap, queries.ts) | Most-referenced table. Public read policy 20260809; is_hidden default fixed 20260820 |
| inquiries | ~57 (17 typed + ~40 migrated) | CORE | 33/35 | actions/{ai,inquiries,messages,reviews}, admin/inquiries/**, api/inquiries, 3 webhooks, dashboard/*, lib/ai/inquiry-agent, lib/inquiry-matcher, whatsapp-bridge | The live transaction table; absorbed the whole `bookings` role |
| experiences | 50 | CORE (degraded) | 37/8 | actions/{admin,ai,bookings,experience-pages,experiences,inquiries,reviews}, admin/**, experiences/[slug]:132, queries.ts, inquiry-agent | Still written by admin legacy trip editor, read for stats + `max_guests`; no longer public page source |
| experience_pages | 54 (50 typed + boats, accommodations, content_blocks, content_photo_urls) | CORE | 24/6 | actions/{experience-pages,guide-photos}, admin/experiences/**, admin/inquiries/new, api/inquiries, experiences/[slug], trips/*, sitemap, queries.ts, inquiry-agent | Drives every live public trip page. 14 ALTERs |
| lead_messages | 9 | CORE | 5/13 | actions/{ai,inquiries,messages}, admin/inquiries/[id], both webhooks, inquiry-agent, whatsapp-bridge | Live CRM message log; supersedes inquiry_messages & booking_messages |
| unmatched_messages | 10 | CORE | 6/8 | actions/{inquiries,messages}, admin/inquiries/unmatched, both webhooks, whatsapp-bridge | Inbound triage queue |
| profiles | 6 | CORE | 7/5 | actions/{admin,auth,bookings,experiences,guide-forms}, admin/layout, dashboard/layout, auth/callback, nav-with-user | Only `id`+`role` (+ full_name/avatar_url in nav) touched. Pure auth-role table |
| experience_page_options | 25 | CORE | 3/5 | actions/experience-pages, admin/experiences/[id]/edit, experiences/[slug]:159 | Every column referenced |
| guide_photos | 7 | CORE | 7/3 | actions/guide-photos, admin/experiences/*, admin/guides/[id], dashboard/photos | Live photo library |
| inquiry_trip_details | ≥10 (GHOST) | CORE | 5/2 | actions/inquiries:1049,1278,1332; admin/inquiries/{page:55,[id]:279}; dashboard/{page:94,trips/[id]:76} | Cols seen: inquiry_id, confirmed_date, confirmed_party_size, price_range, date_flexibility, target_species, accommodation, guide_notes, guide_final_dates, guide_options, updated_at |
| guide_unavailable_dates | ≥2 (GHOST) | CORE | 3/4 | actions/availability:46-107; admin/inquiries/[id]:238; dashboard/calendar:28; experiences/[slug]:136 | Only guide_id, date. Replaced the whole guide_calendars cluster |
| leads | 11 | PERIPHERAL | 4/4 | actions/{admin,guide-apply}, admin/{leads,page,guides/new} | Guide-application intake → guides.lead_id |
| reviews | 10 | PERIPHERAL | 5/2 | actions/{reviews,review-media}, admin/inquiries/[id] | Token-link post-trip reviews (/reviews/[token]) |
| guide_intake_forms | 8 | PERIPHERAL | 4/3 | actions/guide-forms only | Newest (20260813); admin/forms + guide-intake/[token] |
| guide_intake_responses | 5 | PERIPHERAL | 2/1 | actions/guide-forms only | |
| ad_campaigns | 9 | PERIPHERAL | 4/3 | actions/ads, admin/{ads,finances,pipeline} | via `as any` |
| ad_campaign_defs | 7 | PERIPHERAL | 3/2 | actions/ads, admin/ads | |
| fixed_costs | 9 | PERIPHERAL | 1/3 | actions/finances, admin/finances | |
| manual_cost_entries | 7 | PERIPHERAL | 1/2 | actions/finances, admin/finances | |
| finance_settings | 3 | PERIPHERAL | 2/1 | actions/finances, admin/{finances,pipeline} | Only key eur_pln_rate / usd_eur_rate |
| guide_submissions | 19 | PERIPHERAL (half-orphaned) | 3/3 | actions/submissions, admin/submissions/*, admin/experiences/new | Only writer `components/guide/GuideSubmissionForm.tsx` is imported by no page → insert path dead; read-only archive |
| experience_accommodations | 2 | PERIPHERAL (legacy) | 1/5 | actions/{accommodations,experiences}, admin/guides/[id]/trips/[expId]/edit | Legacy experiences editor |
| guide_accommodations | 10 | PERIPHERAL (legacy) | 1/4 | same | |
| guide_images | 6 | PERIPHERAL (legacy) | 1/3 | actions/admin:128, admin/guides/[id]/edit | Superseded by guide_photos |
| bookings | 58 | near-DEAD | 12/12 | actions/{admin,bookings}, admin/guides/[id]:113, api/stripe/webhook:79,87 | Entire actions/bookings.ts (28 exports) imported only by unrendered BookingChat.tsx. Live reads = one revenue tile (status,total_eur,guide_payout_eur) + webhook booking_fee branch (unreachable) |
| booking_messages | 7 | DEAD | 1/1 | actions/bookings only | |
| inquiry_messages | 5 | DEAD-ish | 1/1 | actions/inquiries:757 (insert in try/catch) | Superseded by lead_messages |
| experience_images | 6 | DEAD (write/delete only) | 0/5 | actions/experiences:370,480,483; actions/admin:202,263; queries.ts:45,57 (unreachable fns) | Never read at runtime |
| payments | 9 | DEAD | 0/2 | actions/admin:199,258 (cascade delete only) | Never inserted/read |
| guide_calendars | 4 | DEAD | 0/0 | — | |
| calendar_blocked_dates | 6 | DEAD | 0/0 | — | |
| calendar_experiences | 2 | DEAD | 0/0 | — | |
| experience_availability_config | 9 | DEAD | 0/0 | — | |
| experience_blocked_dates | 6 | DEAD | 0/0 | — | |
| guide_weekly_schedules | 7 | DEAD | 0/0 | — | |
| audit_log | 8 | DEAD | 0/0 | — | trigger-populated? unclear |
| spatial_ref_sys | 5 | TYPE-ONLY | 0/0 | — | PostGIS |

Views geography_columns / geometry_columns: PostGIS, unused. Dead source file `src/lib/mock-data.ts` (597 lines) is imported by nothing and is the sole "reference" for several guides/experiences columns.

## (b) Unused columns per big table

### bookings (58) — ~55 of 58 effectively dead
Zero references anywhere (15): balance_payment_method, balance_stripe_payment_intent_id, guide_stripe_checkout_id, guide_amount_paid_at, guide_amount_stripe_pi_id, iban_shared_at, completed_at, deposit_eur, marketing_consent, payout_sent_at, payout_status, stripe_payment_intent_id, assigned_river, offer_price_min_eur, offer_price_tiers.
Only in types/mock-data (4): angler_country, angler_phone, target_species, experience_level.
Reachable at runtime today (3): status, total_eur, guide_payout_eur (admin/guides/[id]:114) + whatever api/stripe/webhook:79,87 writes.

### experiences (50)
Only in orphaned mock-data (3): license_region, meeting_point_lat, meeting_point_lng. All `select('*')` functions in queries.ts (getExperiences, getFeaturedExperiences, getExperience, getAllExperiencesWithCoords, getMoreFromGuide, getGuideExperiences, getExperienceLocations, getCountryStats) are unimported. Live public reads of `experiences` reduce to `fish_types` and `count(id)`; admin still edits it via 2370-line ExperienceForm.

### experience_pages (54)
Zero references (2): special_attraction_text, special_attraction_image_url (v2 scalars superseded by v3 `special_attractions` JSONB two days later, never dropped). Everything else referenced incl. undeclared boats/accommodations/content_blocks/content_photo_urls.

### guides (57)
Never in a file that queries guides (7): accepted_payment_methods, default_balance_payment_method, external_reviews, iban_holder_name, iban_bic, iban_bank_name, founding_guide_until. `iban` is used (plaintext — field-encryption.ts never called). `calendar_mode` display-only, machinery gone.

### inquiries (~57)
Every migrated column used. Thin coverage: offer_answers, offer_token_expires_at, selected_option_id (actions/inquiries only); email_thread_message_id, trip_country, trip_type (inquiry-agent only); `fa_notes` effectively unused. Constraint orphans: angler_country (nullable since 20260604), trip_id (FK dropped 20260812, NOT NULL dropped 20260530).

### experience_page_options (25)
All used. `faq` added and dropped same day (20260512).

## (c) Duplicated-concept verdicts

1. experiences vs experience_pages vs guide_submissions → **experience_pages wins.** Public route reads experience_pages; touches experiences only for `max_guests` (experiences/[slug]:132). experiences survives as legacy admin editor storage + 2 stats. guide_submissions = read-only archive (writer unrendered).
2. bookings vs inquiries → **inquiries wins decisively.** Whole offer→deposit→completion pipeline lives on inquiries (status CHECK rewritten 20260605, 20260708 → 10-value pipeline; stage_reached with advance-only trigger 20260716). bookings keeps 26 offer/confirm/payout columns duplicating inquiries.offer_*, all unreachable. Types file inconsistent (trip_inquiry_status "removed" at :2559 but still in Constants at :2707).
3. leads vs guides vs guide_intake_forms → all live, different stages; **real risk = two unconnected guide-intake funnels** (guide_intake_forms has no FK to leads or guides).
4. Photos → **guide_photos + experience_pages.{hero_image_url,gallery_image_urls,content_photo_urls,views_image_urls} live**; guide_images (admin insert, edit-page read) and experience_images (insert+delete only) legacy. actions/guide-photos.ts:178-195 rewrites the arrays when photos move buckets → arrays are the live render path.
5. Calendar → **guide_unavailable_dates (undocumented flat table) wins; all 6 declared calendar tables dead.** 20260517_consolidate_guide_calendars was the last effort. availability.ts "open season" = delete all future blocks + insert a row for every day outside range (~730 rows/guide). guides.calendar_disabled still selected; calendar_mode inert.
6. payments vs bookings payment cols → **neither live.** Money tracked on inquiries (deposit_amount, deposit_stripe_session_id, deposit_paid_at, offer_total_eur, offer_deposit_eur, internal_deal_total_eur, internal_commission_eur) via api/webhooks/stripe-deposit.
7. profiles vs guides.user_id → complementary; profiles degenerate (role lookup). profiles.full_name/avatar_url duplicate guides.* (read only in nav-with-user:21).
8. PostGIS fns search_trips_near / get_licenses_for_point / import_license_zone → **DEAD. Zero `.rpc()` calls in the codebase.** Geo computed in JS (trips/exp-page-geo-action.ts). PostGIS installed, unused.

## (d) RPCs & buckets
No `.rpc()` anywhere. Trigger fns: update_*_updated_at ×4, sync_last_contact_at (20260707), inquiries_advance_stage_reached (20260716).
Buckets: `guide-photos` (actions/guide-photos, admin upload comps, profile-edit-form, experience-form; policies 20260415), `offer-photos` (actions/offer-photos, GuideTodoList; policies 20260528), `review-media` (actions/review-media; NO policy migration — dashboard-created), `landscapes` (lib/landscapes.ts URL only), `videos` (public/ static).

## (e) Schema evolution narrative
1. Apr 2026 — marketplace era: dashboard-created experiences, bookings, guides, guide_calendars, payments, profiles, booking_messages.
2. 2026-04-15 — pivot to concierge: inquiries + guide_submissions ("FA flow"), experience_pages, guide_photos land same day. bookings left to rot.
3. Apr–May — experience_pages grows by accretion (_month_columns → _location → _v2 → _v3 → accommodations → content_blocks → content_photos → boats → location_area → price_type → views). v2 scalars never dropped.
4. 2026-05-12 — faq moves options → pages same day.
5. 2026-05-17 — calendar consolidation, then whole cluster abandoned for dashboard-made guide_unavailable_dates (no migration).
6. 2026-05-27/29 — inquiries swallows the offer (totals, deposit, plan, licence, inclusions, Q&A, token, photos, schedule, map): 17 → ~40 cols. inquiry_messages created.
7. 2026-05-30 — inquiries.trip_id nullable, experience_page_id added.
8. 2026-06-03/05 — back office: ad_campaigns, ad_campaign_defs, fixed_costs, manual_cost_entries, finance_settings — all after types regen → `as any` everywhere.
9. 2026-06-05 / 07-08 — status constraint rewritten twice → 10-state pipeline (CHECK, not enum).
10. 2026-06-12 — lead_messages + unmatched_messages + RLS on admin tables; 07-07 trigger for last_contact_at.
11. 2026-07 — AI agent cols (agent_status/round, trip_country/type/priority, email_thread_message_id), stage_reached trigger, reviews, offer_options.
12. 2026-08-12 — FK inquiries→experiences dropped, trip-or-page CHECK dropped. inquiries free-floating.
13. 2026-08-13/15/18 — guide_intake_forms (second funnel), GRANT SELECT to anon, NZ seed migrations (~41 KB). **20260815_fix_nz_species_casing.sql is a 1-byte file containing `4`** — corrupt.
14. 2026-08-20/27 — is_hidden default fix, trip_length + gclid.

**Net shape:** one live spine (guides → experience_pages(+options) → inquiries → lead_messages/unmatched_messages) + ghost pair (inquiry_trip_details, guide_unavailable_dates) + back-office tables (ad_*, fixed_costs, manual_cost_entries, finance_settings, reviews, leads, guide_intake_*) sitting on an intact, unreferenced marketplace schema (bookings, payments, booking_messages, 6 calendar tables, audit_log, experience_images, guide_images, guide_accommodations, experience_accommodations, inquiry_messages) — ~12 dead tables and ~55 dead columns on bookings alone.
