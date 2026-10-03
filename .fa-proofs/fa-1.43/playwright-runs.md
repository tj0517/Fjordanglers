# FA-1.43 Playwright runs — local (http://localhost:3000), 2026-10-03

Server: `next dev` with RESEND_API_KEY=placeholder, ANTHROPIC_API_KEY=placeholder, AI_AUTO_REPLY_ENABLED=false,
UPSTASH_*= (empty), SENTRY_DSN= NEXT_PUBLIC_SENTRY_DSN= (empty), Supabase URL/keys = local stack (port 54421).
Full server log: dev-server.log.

## Tracking blocked before the first page load (context.route, abort)
Test fetches from about:blank to six hosts, all `Failed to fetch`, 6 aborted by the route:
googletagmanager.com, google-analytics.com, googleadservices.com, stats.g.doubleclick.net, google.com/pagead, region1.google-analytics.com

## Human run 2 (typed with delays, 6517 ms on the form) — request list, non-/_next
GET  http://localhost:3000/experiences/fa-143-test-river
GET  http://localhost:3000/icon.png
POST http://localhost:3000/api/events  (x4)
POST http://localhost:3000/api/inquiries   body: trip_notes_extra="" form_elapsed_ms=6517
Non-local: GET https://www.googletagmanager.com/gtag/js?id=AW-18171634204 (ABORTED by route, 0 responses),
           GET https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f1ee-1f1f8.svg (flag image)
responsesFromBlockedHosts: []

## Bot run — script fills every input incl. the trap, submits at once
POST /api/inquiries body: trip_notes_extra="http://spam.example" form_elapsed_ms=331
Non-local: the same two requests; gtag/js aborted, responsesFromBlockedHosts: []

## DB (local, before cleanup)
 human-run@fa143.test   inquiry.created
 human-run2@fa143.test  inquiry.created
 bot-run@fa143.test     inquiry.created ; agent.auto_send_decided sent=false reasons=["trap field filled"]

## Server log
Human runs: `[inquiries/POST] Email error: Error: [email] Resend HTTP 401 ... at sendInquiryReceivedAnglerEmail` , POST /api/inquiries 201 in 2.5 s / 454 ms
Bot run:    no Email error line, POST /api/inquiries 201 in 77 ms
No `[rate-limit]`, upstash, or anthropic lines anywhere in dev-server.log.

## Cleanup
Fixture experience page, 3 test inquiries and their 4 events deleted from the LOCAL db; counts back to 17 inquiries / 6 events / 0 pages.
