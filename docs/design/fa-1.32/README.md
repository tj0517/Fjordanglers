# FA-1.32 — inquiry card mockup (approved by tj 2026-09-25)

Source of truth for the layout of FA-1.32. Canvas: https://claude.ai/artifact/PHSboq4j7qGyTuqSvs3YpJ (private to tj).

Each `.dc.html` file is one screen, 1200 px wide, content area only (the admin sidebar is unchanged).
Open any file in a browser to see it (the `support.js` include will 404 — ignore it; markup and inline styles render).

| File | Stage / tab |
|---|---|
| Main.dc.html | Qualifying — Offer & payment, no offer yet |
| OfferPresented.dc.html | Offer presented — Offer & payment |
| AwaitingPayment.dc.html | Awaiting payment — Offer & payment |
| Paid.dc.html | Paid — Offer & payment |
| Conversation.dc.html | Conversation tab, composer with AI off |

Decisions baked in (tj 2026-09-25):
- Header: name + contact left, status right; facts (trip, country, group, dates, guide, commission) in one labelled grid, "—" for missing values, no emoji; 8-segment stage bar; underline tabs with message count.
- Offer & payment: two columns — left "Next step" (only the stage's action; no "Thread actions" box), right "Deal" (numbers) and "Internal" (deal tracker, external offer, review link) as rows.
- Salmon (#E67E50) only on the stage's single primary button.
- "Balance to guide" = trip price − deposit.
- Composer: neutral placeholder "Write your message to <first name>…"; with AI off (server flag) "Zaproponuj" is absent from the DOM.
- Dates shown as "10–13 Aug 2026"; fixing today's "Invalid Date" is tracked in deferred, not part of FA-1.32 unless tj decides otherwise.
Colors: Fjord Navy #0A2E4D, Glacier White #F8FAFB, Salmon #E67E50; fonts Fraunces (display) + DM Sans (body).
