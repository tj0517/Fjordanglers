# FA-M — guide app MVP mockup (approved by tj 2026-11-17)

Source of truth for the layout and copy of the guide-facing screens of stage M. Canvas: https://claude.ai/artifact/FYUPrL3h8vhxRBk1p35Ryw (private to tj).

Each `.dc.html` file is one phone screen, 390 px wide. Open any file in a browser to see it (the `support.js` include will 404 and the `/_blob/…` logo images will not load — ignore both; markup and inline styles render). Screens with `{{…}}` holes compute their data in the `<script type="text/x-dc">` block at the bottom (calendar grids, selection states).

| File | Screen | Tasks |
|---|---|---|
| Push.dc.html | Push for a new request + the single reminder | FA-M.12 (push text), FA-M.06 (reminder: same wording on WhatsApp) |
| Main.dc.html | Request page `/r/[token]` | FA-M.04 (done — reference only), FA-M.07 (brief rows Accommodation + Licence, block "Note from FjordAnglers") |
| OtherDates.dc.html | Other dates — pick 1–3 days, busy days disabled | FA-M.04 (done — reference only), FA-M.09 (busy days come from the sync) |
| Decline.dc.html | Decline with optional reason | FA-M.04 (done — reference only) |
| Done.dc.html | Confirmation after answering + "add to home screen" nudge | FA-M.04 (done — reference only), FA-M.12 (nudge) |
| SignIn.dc.html | Guide sign-in (email + password) | FA-M.08 (done — reference only) |
| Requests.dc.html | Guide's requests: "Waiting for you" on top, answered below with status | FA-M.13 |
| Calendar.dc.html | What FA sees: sync status, busy days by source, manual blocks | FA-M.13, FA-M.09 |
| Connect.dc.html | "Connect your calendar": Google button, Apple share-link steps, manual fallback | FA-M.09 (Apple), FA-M.10 (Google), FA-M.13 (in account) |
| Settings.dc.html | Account: push toggle, WhatsApp always on, add-to-home-screen steps, sign out | FA-M.12, FA-M.13 |

Decisions baked in (tj 2026-11-17):
1. The request page shows no calendar signal ("free in your calendar"). Calendar data appears only on Other dates (busy days disabled) and in the Calendar tab.
2. A guide changes an answer only by messaging FA on WhatsApp; the page shows the answer, no edit.
3. No amount or guide rate on the request (in line with FA-M.04 decision 2: no budget lines).
4. Sign-in is email + password (FA-M.08).
5. Manual day blocks stay in the MVP next to the calendar sync.
6. Guide navigation has three items: Requests, Calendar, Account.
7. WhatsApp is the guaranteed channel; push is an extra for guides who added the app to the home screen.

How to use it:
- Layout, hierarchy, states and copy (English, literal in the files) follow the mockup.
- Colors: Fjord Navy #0A2E4D, Glacier White #F8FAFB, Salmon #E67E50. The primary button is Salmon with Navy text (white on Salmon fails contrast). Salmon only on the single primary action of a screen.
- Fonts and components come from the app (`docs/03-conventions.md`, self-hosted fonts). The mockup uses Poppins as a stand-in — do not add it.
- Icons in the files are inline placeholders; use the app's icon set.
- The Google button has no Google logo in the mockup; if FA-M.11 verification requires Google's sign-in branding, that wins.
- Sample data (Josh, Taupō, dates, numbers) is illustrative.
- Where the mockup conflicts with a task's scope or "Gotowe, gdy", the task wins — report the difference instead of choosing.
