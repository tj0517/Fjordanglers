# FA-1.61 phase A — POST /api/inquiries, stage timings BEFORE (origin/main 2159df5 + temporary timing lines)

All numbers in ms. Local `next dev --turbo` (Next 16.1.6), local Supabase (4 containers), real Anthropic calls, **e-mail faked** (`RESEND_DEV_FAKE=1`: no template render, no Resend HTTP call — so the e-mail stage is a lower bound, see caveats). First request of each shape is a discarded warm-up (compilation). `AI_AUTO_SEND_DAILY_CAP=1000` in the dev process so the daily cap (default 5) does not short-circuit the send. Rate limiter fails open (no Upstash config).


## V1 body shape (experience_page_id, requested_dates/trip_length, no brief) — page seed-backcountry-day-nz


### (a) normal inquiry, AI enabled — n=5

| stage | min | median | max |
|---|---:|---:|---:|
| validation + page lookup | 6.5 | 11.0 | 14.4 |
| createInquiry insert | 12.7 | 20.4 | 23.2 |
| repeat lookup + skip event | 5.6 | 7.0 | 12.0 |
| 2 e-mails (Promise.all, faked) | 1.1 | 1.6 | 17.1 |
| classifyInquiry | 1235 | 1295 | 1576 |
| autoSendReply | 4324 | 5084 | 6293 |
| TOTAL in handler | 5652 | 6361 | 7701 |
| client round trip | 5669 | 6378 | 7731 |

flags seen: suspicious=False repeat=False ai=True

### (b) trap field filled (`trip_notes_extra: "x"`) — n=5

| stage | min | median | max |
|---|---:|---:|---:|
| validation + page lookup | 6.3 | 7.0 | 11.2 |
| createInquiry insert | 12.9 | 13.9 | 29.5 |
| repeat lookup + skip event | 6.3 | 7.2 | 10.9 |
| 2 e-mails (Promise.all, faked) | 0.0 | 0.0 | 0.0 |
| TOTAL in handler | 26.5 | 27.5 | 50.8 |
| client round trip | 40.4 | 48.2 | 72.3 |

flags seen: suspicious=True repeat=False ai=False

### (c) repeat (same e-mail as an inquiry from seconds earlier) — n=5

| stage | min | median | max |
|---|---:|---:|---:|
| validation + page lookup | 6.5 | 6.9 | 10.9 |
| createInquiry insert | 13.4 | 14.0 | 14.8 |
| repeat lookup + skip event | 11.7 | 13.5 | 14.5 |
| 2 e-mails (Promise.all, faked) | 0.4 | 0.4 | 0.5 |
| TOTAL in handler | 32.6 | 35.0 | 40.5 |
| client round trip | 45.7 | 49.3 | 56.5 |

flags seen: suspicious=False repeat=True ai=False

## V2 body shape (experience_page_id + brief + angler_country) — page seed-backcountry-day-nz


### (a) normal inquiry, AI enabled — n=4

| stage | min | median | max |
|---|---:|---:|---:|
| validation + page lookup | 6.2 | 6.3 | 6.6 |
| (v2) primary-guide lookup | 4.4 | 5.0 | 5.4 |
| createInquiry insert | 13.6 | 15.1 | 17.0 |
| repeat lookup + skip event | 4.9 | 6.2 | 8.9 |
| 2 e-mails (Promise.all, faked) | 1.0 | 1.1 | 1.1 |
| classifyInquiry | 1253 | 1434 | 2392 |
| autoSendReply | 6253 | 8141 | 9544 |
| TOTAL in handler | 8678 | 9611 | 10830 |
| client round trip | 8692 | 9629 | 10843 |

flags seen: suspicious=False repeat=False ai=True

### (b) trap field filled (`trip_notes_extra: "x"`) — n=4

| stage | min | median | max |
|---|---:|---:|---:|
| validation + page lookup | 6.0 | 7.5 | 10.0 |
| (v2) primary-guide lookup | 4.0 | 5.7 | 6.2 |
| createInquiry insert | 13.6 | 13.9 | 36.0 |
| repeat lookup + skip event | 6.1 | 6.5 | 6.7 |
| 2 e-mails (Promise.all, faked) | 0.0 | 0.0 | 0.0 |
| TOTAL in handler | 30.3 | 34.3 | 57.8 |
| client round trip | 43.9 | 49.3 | 74.8 |

flags seen: suspicious=True repeat=False ai=False

### (c) repeat (same e-mail as an inquiry from seconds earlier) — n=4

| stage | min | median | max |
|---|---:|---:|---:|
| validation + page lookup | 5.7 | 6.5 | 7.6 |
| (v2) primary-guide lookup | 3.8 | 4.2 | 4.9 |
| createInquiry insert | 13.9 | 14.0 | 16.7 |
| repeat lookup + skip event | 9.7 | 12.0 | 14.8 |
| 2 e-mails (Promise.all, faked) | 0.4 | 0.4 | 0.5 |
| TOTAL in handler | 34.8 | 38.3 | 41.7 |
| client round trip | 49.5 | 53.5 | 54.9 |

flags seen: suspicious=False repeat=True ai=False

## Caveats (read before comparing with prod)

- Prod on 15.10 answered in 32 s and 15 s; locally the same code answers in 5.7–7.7 s (v1 shape) and 8.7–10.8 s (v2 shape). The gap is NOT explained by this measurement. Things this run does not include: real Resend (here `RESEND_DEV_FAKE=1` returns before `render()` and before the HTTP call, so the e-mail stage is ~1 ms instead of render + a network round trip), a Vercel cold start, Supabase prod round-trip latency (local DB is on loopback; `autoSendReply` makes many queries), the Anthropic latency of that moment, and `next dev --turbo` vs a production build.
- Dominant stages locally: `autoSendReply` (draft + judge LLM calls + send) ≈ 4.3–9.5 s and `classifyInquiry` ≈ 1.2–2.4 s; everything before the AI (lookup + insert + repeat lookup + e-mails) is ≈ 25–60 ms. So any option that moves only the AI out of the response moves ~99 % of the local wait; whether the e-mails are worth moving depends on the real Resend cost, which only a prod-like run can show.
- First request of each shape is a discarded warm-up (compilation); the first request of the whole session also included `proxy.ts` compile (265 ms).
- Trap (b): ~27–58 ms, no e-mail, no AI — matches prod's 0.3 s. Repeat (c): ~35–42 ms in the handler (FA e-mail still goes out, angler e-mail and AI skipped).
- Rate limiter: fails open (`getRateLimiter()` returns null when `UPSTASH_REDIS_REST_URL`/`TOKEN` are unset, `src/lib/rate-limit/factory.ts:25-29`; `activeLimiter()` null → `ALLOWED`, `src/lib/rate-limit/inquiries.ts:49-53,62`). No Upstash/`RATE_LIMIT_SALT` key exists in `.env.local` or `.env.development.local` (checked by key name only).
- `AI_AUTO_SEND_DAILY_CAP=1000` was set on the dev process so the default cap (5/day) did not turn later runs into "held" results.
- `ai: true` rows really called Anthropic (real key), `agent_knowledge` has an active `instructions` row locally.

## Browser, click on Send → success screen (Playwright, 1280x900, `next dev`, Google requests aborted)

See `send-to-success-before.log`: v1 = 8778 / 7025 / 7888 ms (median 7888); v2 = 12447 / 9471 / 10429 ms (median 10429). The POST response accounts for all of it (click→response is within ~15 ms of click→success).
