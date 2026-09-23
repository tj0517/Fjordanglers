# Self-hosted fonts

These woff2 files are committed to the repo so `pnpm build` makes no request to
Google Fonts (FA-0.22). They are served via `next/font/local` in `src/app/layout.tsx`.

## Files

| File | Font | Version | Subset | Axes |
|---|---|---|---|---|
| `Fraunces-Variable.woff2` | Fraunces normal | v38 | latin | opsz, wght 100–900 |
| `Fraunces-Variable-Italic.woff2` | Fraunces italic | v38 | latin | opsz, wght 100–900 |
| `DMSans-Variable.woff2` | DM Sans normal | v17 | latin | opsz, wght 100–900 |

## Sources

Files are the Latin-subset woff2 slices served by the Google Fonts CDN
(`fonts.gstatic.com`) as of 2026-09-23, fetched by requesting:

- Fraunces: `https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,100..900;1,9..144,100..900&display=swap`
- DM Sans: `https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,100..900&display=swap`

Upstream font projects:
- Fraunces — https://github.com/undercasetype/Fraunces (Undercase Type)
- DM Sans — https://github.com/googlefonts/dm-fonts (Google Fonts / Colophon Foundry)

## Licence

Both fonts are licensed under the SIL Open Font License, Version 1.1.
See `OFL.txt` in this directory (the Fraunces OFL — identical text for DM Sans).

Copyright notices:
- Fraunces: © 2018 The Fraunces Project Authors
- DM Sans: © 2014 The DM Sans Project Authors
