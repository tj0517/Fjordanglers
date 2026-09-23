# Self-hosted fonts

These woff2 files are committed to the repo so `pnpm build` makes no request to
Google Fonts (FA-0.22). They are served via `next/font/local` in `src/app/layout.tsx`.

## Files

| File | Font | Version | Subset | Axes |
|---|---|---|---|---|
| `Fraunces-Variable.woff2` | Fraunces normal | v38 | latin | wght 100–900 |
| `Fraunces-Variable-Italic.woff2` | Fraunces italic | v38 | latin | wght 100–900 |
| `DMSans-Variable.woff2` | DM Sans normal | v17 | latin | wght 100–1000 |

`wght` axis only — no `opsz`. Matches the original font request which listed discrete
weights and did not activate optical sizing.

## Sources

Files are the Latin-subset woff2 slices served by `fonts.gstatic.com` as of 2026-09-23,
fetched by requesting the **weight-only** variants:

- Fraunces: `https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,100..900;1,100..900&display=swap`
- DM Sans: `https://fonts.googleapis.com/css2?family=DM+Sans:wght@100..900&display=swap`

Upstream font projects:
- Fraunces — https://github.com/undercasetype/Fraunces (Undercase Type)
- DM Sans — https://github.com/googlefonts/dm-fonts (Google Fonts / Colophon Foundry)

## Licence

Both fonts are licensed under the SIL Open Font License, Version 1.1.
See `OFL.txt` in this directory (the Fraunces OFL — identical text for DM Sans).

Copyright notices:
- Fraunces: © 2018 The Fraunces Project Authors
- DM Sans: © 2014 The DM Sans Project Authors
