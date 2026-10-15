# FA-1.61 — scroll to the first invalid field: before / after

Local `next dev`, Chromium via Playwright, seed page `seed-backcountry-day-nz`, Google hosts aborted, no valid inquiry sent. Same scenarios and script logic for both runs (`scroll-probe.mjs` before, `scroll-probe-after.mjs` after: only the settle wait after the click grew from 400 ms to 1500 ms so the smooth scroll has finished). Visible % = share of the field's height inside the viewport AND every clipping ancestor (the modal/wizard scroll area).

| scenario | viewport | visible before | visible after | activeElement before | activeElement after | aria-invalid before | aria-invalid after |
|---|---|---|---|---|---|---|---|
| v1 modal, first name empty (body scrolled to bottom) | 1280x720 | 0% | 100% | button[submit]: | input[text]:Erik | None | true |
| v1 modal, first name empty (body scrolled to bottom) | 390x667 | 0% | 100% | button[submit]: | input[text]:Erik | None | true |
| v1 modal, first name empty (body scrolled to bottom) | 390x844 | 0% | 100% | button[submit]: | input[text]:Erik | None | true |
| v2 step 3, first name empty | 1280x720 | 0% | 100% | button[button]:wizard-next | input[text]:First nameYour first n | true | true |
| v2 step 3, first name empty | 390x667 | 0% | 100% | button[button]:wizard-next | input[text]:First nameYour first n | true | true |
| v2 step 3, first name empty | 390x844 | 100% | 100% | button[button]:wizard-next | input[text]:First nameYour first n | true | true |
| v2 step 2, nothing answered (first group = fieldset) | 1280x720 | 0% | 100% | button[button]:wizard-next | input[radio]:First timeI have never | None | true |
| v2 step 2, nothing answered (first group = fieldset) | 390x667 | 0% | 83% | button[button]:wizard-next | input[radio]:First timeI have never | None | true |
| v2 step 2, nothing answered (first group = fieldset) | 390x844 | 0% | 100% | button[button]:wizard-next | input[radio]:First timeI have never | None | true |

Notes
- v2 step 2 at 390x667: the first group is 597 px tall in a 498 px scroll area, so 83% is the most that can be visible. The group is aligned to the top of the area (`block: 'start'`, the oversize fallback in `scroll-to-field.ts`) instead of centred, so its legend and first radio are in view; centred, the legend was cropped. At the other sizes the group fits and is centred (`block: 'center'`).
- "activeElement after" for step 2 is the group's first radio (`input[type=radio]`, "First time"); the group's `<fieldset>` carries `aria-invalid="true"` and `aria-describedby` = the id of its `<p role="alert">` (e.g. `_r_3_` → "Pick the line that fits you best."), see `structure` in `scroll-after.log`.
- v2 step 3 `aria-invalid` was already `true` before (TextField); v1 had none.
- v2 inline step-1 "Continue" (S14) is unchanged by design (D2.2): `after-v2-inline-*.png` and the `inline` entries of `scroll-after.log` show it still only prints "Pick a month." and focuses nothing new.
- The window's own `scrollY` moves between "pre" and "post" in some v2 runs in BOTH logs (e.g. 2040 → 89 before, 2040 → 0 after at 1280x720); it is the page behind the overlay settling, not this change.
- `postRequests` is 0 in every run: no inquiry was sent.
