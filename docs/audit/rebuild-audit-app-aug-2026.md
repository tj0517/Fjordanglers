# FjordAnglers — Application Audit (repo snapshot 2026-08-31)

Scope: 292 files under src/ (~74k lines), 68 migrations, 5 whatsapp-bridge scripts. Next.js 16 App Router (src/proxy.ts = Next 16 middleware).

## 1. Route inventory

### PUBLIC
| Path | File | Purpose | Data |
|---|---|---|---|
| / | app/page.tsx | Home: hero video, species slider, featured experience pages + guides | queries.ts → experience_pages, guides |
| /trips | app/trips/page.tsx | Listing + map, ?country, ?page, revalidate=60 | experience_pages via createServiceClient() |
| /experiences/[slug] | app/experiences/[slug]/page.tsx (1617 lines) | THE money page — editorial page + InquiryWidget, revalidate=3600 | experience_pages, experience_page_options, guides, guide_unavailable_dates (ad-hoc selects) |
| /guides, /guides/[id] | app/(public)/guides/* | Directory + profile (id→slug redirect) | getGuides, getGuide, getGuideExperiencePages |
| /guides/apply | app/(public)/guides/apply | Guide application | actions/guide-apply → leads |
| /blog, /blog/[slug] | app/(public)/blog/* | Fully static; 1 of 6 posts has content; NOT in nav | lib/blog-data.ts |
| /about | static | | |
| /plan-your-trip | app/plan-your-trip | 4-step ads landing funnel; robots disallow; unlinked | **email only via actions/trip-plan.ts — NO DB row** |
| /legal/* | static | | |
| sitemap.ts, robots.ts | | robots still disallows ghost routes /account/, /book/, /invite/ | experience_pages, guides |

(public) route group wraps only /blog and /guides; /, /trips, /experiences, /about each import NavWithUser + SiteFooter individually.

### AUTH
/login (AuthTabs), /register (redirect), /forgot-password, /reset-password, /auth/callback (PKCE; upserts profiles.role; links guides.invite_email → user_id), /auth/reset.

### GUIDE DASHBOARD /dashboard
Protection: proxy.ts (auth) + dashboard/layout.tsx (profiles.role; admin→/admin; auto-creates minimal guides row on first visit; TermsGate on guides.terms_accepted_at).
/dashboard (assigned trips, 4-state badge), /trips, /trips/[id] (accept/decline, brief, todo), /calendar (guide_unavailable_dates), /photos (guide_photos + bucket), /profile, /profile/edit (970-line form; guides, guide_images), /account.
No /dashboard/trips/new or edit — guides cannot create trips.

### ADMIN /admin
Protection: proxy.ts + admin/layout.tsx (profiles.role==='admin'). Every page uses createServiceClient() (RLS bypassed).
/admin (overview), /guides (+new, [id], [id]/edit), /guides/[id]/trips/new + [expId]/edit (LEGACY experiences CRUD, 2370-line ExperienceForm), /experiences (+new,[id],[id]/edit — ExperiencePageForm 2113 lines, live content editor), /inquiries (InquiriesClient 884 + InquiriesCalendar 684, client-side filtering), /inquiries/[id] (683-line page + 8 tabs — operational centre), /inquiries/new, /inquiries/unmatched, /pipeline (stage_reached funnel + ad spend), /finances (P&L / deals / fixed costs), /ads, /forms (+new,[id]), /leads, /submissions (+[id]).
Nav gap: AdminSidenav lacks /admin/leads and /admin/submissions.

### API / WEBHOOKS / CRON
| Path | Purpose | Auth |
|---|---|---|
| POST /api/inquiries | Public intake; zod; resolves experience_pages; inserts inquiries(status pending); emails; optional runAgentRound1 | none |
| POST /api/webhooks/stripe-deposit | checkout.session.completed w/ metadata.payment_type=inquiry_deposit → deposit_paid; 3 emails; idempotent on deposit_paid_at | signature |
| POST /api/stripe/webhook | account.updated → guides.stripe_*; booking_fee branch → bookings (unreachable) | signature |
| POST /api/webhooks/email-inbound | Resend Inbound; svix verify; re-fetch body; matchInquiryByEmail → lead_messages / unmatched_messages; may runAgentRound2 | svix (skipped if secret unset) |
| GET/POST /api/webhooks/whatsapp | Meta Cloud API; HMAC; matchInquiryByPhone (scans 500 recent rows in JS) | token+secret |
| POST /api/cron/sync-google-ads | upserts ad_campaigns | Bearer CRON_SECRET — **route is POST-only; Vercel cron sends GET → cannot fire** |

### TOKEN PAGES
/offers/[token] (573 + OfferOptionsPanel 494; branches on status; multi-option + legacy), /reviews/[token], /guide-intake/[token].

## 2. Broken links in shipped code
- proxy.ts:64 → authenticated users on /login|/register redirected to **/account (does not exist)**.
- actions/inquiries.ts:290, :598 → Stripe success_url **/inquiry-confirmed (does not exist)** — every paying angler lands on 404.
- dashboard/profile/page.tsx:19 → /auth/login (should be /login).
- admin/guides/[id]/trips/[expId]/edit:121 → /admin/trips (missing).
- components/admin/copy-invite-link.tsx:22 → /invite/[id] (missing).

## 3. Dead code (verified by import grep)
Actions: accommodations.ts (166), **bookings.ts (1231)** — only importer BookingChat.tsx, itself dead.
lib: mock-data.ts (597), experience-helpers.ts (182), stripe/connect.ts (94), stripe/webhooks.ts (64), **field-encryption.ts (84) never called → guides.iban plaintext**, periods.ts.
Components (~6.5k lines): home/{hero-search-bar, hero-search, hero-video-cta, home-faq, parallax-layer, search-widget}; trips/{species-card, accommodation-gallery, ExperiencePageWithOptions, experience-location-map(+client)}; auth/{login-form, register-form}; guides/onboarding-wizard (1188); dashboard/guide-onboarding (548); guide/GuideSubmissionForm (484); booking/BookingChat (302); offer/LocationMap; analytics/{fb-event, ga-event}.
Route-local: admin/inquiries/[id]/{InquiryActionPanel (571), AssignGuidePanel, OfferBuilderModal, SendDepositButton, InquiriesFilters}; app/trips/{search-bar 391, filters-modal 565, filters, sort-select} (whole faceted search UI); dashboard/account/{BankAccountForm 407, PayoutSettingsCard 177, StripeConnectButton, StripeSyncButton, HideListingToggle} → **whole Stripe-Connect-for-guides UI unmounted**, so actions/stripe-connect.ts (419) reachable only via dead UI.
queries.ts: 8 of 15 exports dead (all targeting legacy experiences).
Total ≈ 10k lines verified dead.

## 4. Duplicates
1. Two lead-intake paths that don't converge: InquiryWidget → /api/inquiries → DB; /plan-your-trip → trip-plan.ts → raw fetch to Resend only. **Ads-funnel leads never reach inquiries/admin/finances.**
2. Two content systems: experiences (+images, +accommodations; ExperienceForm) vs experience_pages (+options; ExperiencePageForm). Public renders only experience_pages. api/inquiries/route.ts:77 comment says "legacy experiences table no longer exists" yet 20 files still query it incl. stripe-deposit webhook:110 and 4 hot paths in actions/inquiries (sendDepositLink, submitOfferAnswers, sendOfferEmail, sendMessageToAngler) — fall back to 'Your trip'/'the guide'.
3. Two message logs: lead_messages (13 sites) vs inquiry_messages (2, try/catch).
4. Two WhatsApp ingestion paths: api/webhooks/whatsapp (Meta Cloud) vs whatsapp-bridge/index.mjs (whatsapp-web.js, PM2, :3001).
5. Two email ingestion paths: api/webhooks/email-inbound (Resend) vs whatsapp-bridge/import-emails.mjs + poll-emails.mjs (Zoho IMAP, PM2 5-min) — different dedupe logic.
6. Two PipelineClient components (finances vs pipeline) with different meaning.
7. Emails: 23 templates all used, but 3 offer-email variants + 2 booking-confirm variants; trip-plan.ts bypasses lib/email with inline HTML.
8. Supabase clients cleanly factored (client/server/middleware/index) — not duplicated.

## 5. Core business flow as implemented
Intake: web form → inquiries(pending) + emails + agent R1; manual (/admin/inquiries/new); inbound email/WhatsApp → matcher → lead_messages | unmatched_messages; historic imports via bridge. Attribution: GclidCapture → localStorage 90d → inquiries.gclid; lib/leadValue.ts → GA4.
AI agent (lib/ai/inquiry-agent.ts 610): gated on AI_AUTO_REPLY_ENABLED; R1 after create, R2 from email webhook when agent_status='waiting'; classifies trip_country/trip_type/priority; agent_round max 3; email_thread_message_id. lib/ai/extract-trip.ts → inquiry_trip_details.
Assignment: assignGuideToInquiry / assignGuideSilently / respondToAssignment (guide_acceptance) / saveGuideOfferEta / saveGuideOfferResponse / unassignGuide — **none touch inquiries.status**.
Offer→deposit: saveOfferDraft/saveRichOffer (offer_* cols, offer_token, stage_reached offer_sent) → sendOfferEmail → /offers/[token]: acceptOffer→in_negotiation, declineOffer→lost, submitOfferAnswers→Stripe Checkout (EUR, metadata inquiry_deposit, idempotency key includes Date.now() → not idempotent) → deposit_sent; admin sendDepositLink(30%) → same; webhook → deposit_paid.
Statuses (CHECK, 10): pending, in_negotiation, waiting_for_guide_offer, offer_sent, waiting_for_deposit, deposit_sent, deposit_paid, completed, lost, cancelled. Only 5 set by code (pending, deposit_sent, in_negotiation, lost, deposit_paid); the other 5 only manually via StatusChanger → status vs stage_reached/offer_sent_at diverge. stage_reached (monotonic trigger): inquiry → offer_sent → deposit_paid → completed — the trustworthy field.
Finances: revenue = inquiries status∈{deposit_paid,completed}, amount = offer_deposit_eur ?? deposit_amount ?? internal_commission_eur, bucket by deposit_paid_at ?? updated_at; costs = ad_campaigns.spend + fixed_costs + manual_cost_entries; FX via finance_settings.

## 6. Data-layer pattern
Ad-hoc selects in page components; no service layer for admin, partial for public. `.from()` in 65 distinct files (19/22 actions, 20 pages/routes, 5 client components, 4 lib). Four fetching styles at once (server comp + service client; server comp + user client; server actions; client-side createClient). Only repository = lib/supabase/queries.ts (811 lines, 4 public pages, 0 admin pages, 8/15 exports dead).
Types stale (2718 lines): missing lead_messages, unmatched_messages, reviews, ad_campaigns, ad_campaign_defs, fixed_costs, manual_cost_entries, finance_settings, guide_intake_forms, guide_intake_responses, inquiry_trip_details, guide_unavailable_dates, inquiry_messages → `as any` in 31 files (41× in actions/inquiries.ts).
**Authorization is layout-only.** Server actions: admin.ts 13 role checks; guide-forms 5; experiences 2; **inquiries.ts (28 actions) 0**; ads/finances/experience-pages/messages/reviews/ai/offer-photos/review-media 0. deleteInquiry, updateInquiryStatus, saveInternalDeal, sendMessageToAngler, addAdCampaign, createExperiencePage… run service-role writes with no caller check.

## 7. Config / infra
next.config: redirects /terms,/privacy; image remotePatterns unsplash + supabase; withSentryConfig(tunnelRoute /monitoring); sentry.{client,server,edge}.config.ts + instrumentation.ts exist at repo root and are wired (enabled only when NEXT_PUBLIC_SENTRY_DSN set) — OK.
vercel.json: 1 cron (POST-only route).
proxy.ts: guards /dashboard,/admin auth-only; role in layouts.
env.ts (zod): full list in report; NEXT_PUBLIC_GTM_ID, META_PIXEL_ID, CLARITY_ID used but unschema'd; PLATFORM_COMMISSION_RATE, WHATSAPP_PHONE_NUMBER_ID declared never read. **AI_AUTO_REPLY_ENABLED uses z.coerce.boolean → "false" enables it.**
Analytics: Consent Mode v2, GTM, gtag AW-18008446689 hardcoded, JSON-LD, Clarity + Meta Pixel consent-gated.
131/292 files 'use client'. revalidate on 6 pages; admin pages uncached service-client.
whatsapp-bridge: separate Node pkg under PM2 sharing lead_messages/unmatched_messages.

## 8. Docs vs code
CLAUDE.md (830 lines) describes a Stripe-Connect booking marketplace (payment tiers, destination charges, service fee cap, cancellation engine, 3 crons, bookings core, money in cents). **None of it is built.** Code = agency funnel: inquiry → AI qualification → FA offer → FA-account Stripe deposit → manual pipeline → internal commission. Money stored as euro decimals. .claude/IMPLEMENTATION_PLAN.md = original plan, superseded (route groups, onboarding wizard, requireAuth() never created — root cause of missing action auth, UI kit never built). .claude/agents/fa-inquiry-flow.md is the only doc matching reality (refs non-existent docs/FLOW.md). head/06-content-branches.md + voice-of-customer.md not reflected in code (blog 1/6 posts, not in nav).

## 9. Tests
One file: src/lib/leadValue.test.ts (42 lines). No vitest/playwright config found in snapshot (vitest.config.ts exists at repo root per ls). Zero coverage of state machine, matchers, webhooks, agent, finance math, auth.

## Top findings ranked
1. Server actions have no authorization (inquiries.ts: 28 actions, 0 checks).
2. Two payment success URLs → non-existent /inquiry-confirmed; /login redirect → non-existent /account.
3. Supabase types 3 months stale → 13 tables untyped, `as any` in 31 files.
4. Two content models (experiences vs experience_pages); 4 hot actions + deposit webhook read the dead one.
5. /plan-your-trip leads never enter DB.
6. ~10k lines verified dead code.
7. Status machine half-manual; stage_reached is the trustworthy field.
8. Cron cannot fire (route POST-only, Vercel cron sends GET — confirmed), feature flag inverts on "false", IBAN plaintext.
