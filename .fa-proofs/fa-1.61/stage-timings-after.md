# FA-1.61 phase A re-run on the NEW code (branch head 066d6a1: classify + autoSend in one `after()`; e-mails still before the response)

Client round trip of `POST /api/inquiries` (ms, min / median / max), measured from outside the route (no instrumentation). Same page, same bodies, same setup as `stage-timings-before.md` (local `next dev --turbo`, `RESEND_DEV_FAKE=1`, real Anthropic, `AI_AUTO_SEND_DAILY_CAP=1000`, warm-up discarded). Raw: `client-timings-after.log`.

| body | case | n | BEFORE (origin/main 2159df5) | AFTER (066d6a1) |
|---|---|---:|---|---|
| v1 | (a) normal, AI on | 5 | 5669 / 6378 / 7731 | **44 / 55 / 73** |
| v1 | (b) trap | 5 | 40 / 48 / 72 | **37 / 42 / 59** |
| v1 | (c) repeat | 5 | 46 / 49 / 56 | **44 / 48 / 49** |
| v2 | (a) normal, AI on | 4 | 8692 / 9629 / 10843 | **45 / 46 / 50** |
| v2 | (b) trap | 4 | 44 / 49 / 75 | **43 / 44 / 46** |
| v2 | (c) repeat | 4 | 50 / 53 / 55 | **44 / 52 / 93** |

## The AI work still happens, after the response (`after-work-proof.log`)

Local DB polled (SELECT only, ~100 ms granularity) until `agent.auto_send_decided` exists for the inquiry; ms counted from the moment the 201 arrived.

| body | run type | n | response ms (min/med/max) | `agent.auto_send_decided` landed, ms after the 201 (min/med/max) | all landed |
|---|---|---:|---|---|---|
| v1 | a-normal | 5 | 44 / 55 / 73 | 6743 / 8769 / 11680 | True |
| v1 | c0-first-of-pair | 5 | 38 / 40 / 42 | 7446 / 7923 / 8057 | True |
| v2 | a-normal | 4 | 45 / 46 / 50 | 8241 / 10256 / 18091 | True |
| v2 | c0-first-of-pair | 4 | 42 / 44 / 45 | 9863 / 12310 / 12386 | True |

For (a) runs: `qualified_set` events and `messages` rows (draft saved): v1: messages=[1, 1, 1, 1, 1] qualified_set=[0, 0, 0, 0, 0], v2: messages=[1, 1, 1, 1] qualified_set=[1, 1, 1, 1]

(b)/(c): exactly one `agent.auto_send_decided` (sent=false, reason = trap / repeat), zero `inquiry.qualified_set`, zero `messages`, checked >= 15 s after the last request:

| body | case | n | decided=1 | qualified_set=0 | messages=0 | reasons |
|---|---|---:|---|---|---|---|
| v1 | b-trap | 5 | True | True | True | ['trap field filled'] |
| v1 | c-repeat | 5 | True | True | True | ['repeat submission from same e-mail within 24 h'] |
| v2 | b-trap | 4 | True | True | True | ['trap field filled'] |
| v2 | c-repeat | 4 | True | True | True | ['repeat submission from same e-mail within 24 h'] |

## Notes
- Every (a) run ended at the destination gate: `agent.auto_send_decided` with `sent=false`, reason "no active destination knowledge entry for country: New Zealand" (local `agent_knowledge` has no destination entry for that country). So draft (LLM) ran and a draft message was saved, but judge and send never ran, before or after. The BEFORE `autoSendReply` stage and the AFTER event latency are therefore a lower bound for a prod-like path. The count is identical in the before runs (24 of the before-run events had this reason).
- v1-body runs show `qualified_set=0` (classify result "unknown" for that body), v2-body runs show 1; same as in the before runs (before: 11 `inquiry.qualified_set` events over ~22 AI runs).
- Browser, click Send -> success (Playwright 1280x900, `send-to-success-after.log`): v1 164 / 172 / 169 ms (median 169; before median 7888); v2 515 / 127 / 119 ms (median 127; before median 10429). v2 run 1 includes the first compile of the route in that fresh dev-server process (494 ms to response); steady state is ~100-160 ms in the browser vs ~45 ms for the bare API call (click handling, fetch, React).
- After-work event landed (ms after the 201), browser runs: v1 10441 / 9903 / 7314; v2 10083 / 8677 / 10761.
- Dev-server log greps (both after-code servers): `Agent error` 0, `Auto-send error` 0, `Could not schedule` 0, "An error occurred in a function passed to `after()`" 0; `Email error` 0. 41 + 3 `POST /api/inquiries 201` lines.
