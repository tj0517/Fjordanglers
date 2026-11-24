# Blog — makieta artykułu i listy (zaakceptowana przez tj, 23 XI 2026)

Dwie plansze z kanwy Claude Design „FjordAnglers — Blog i huby (system sekcji)”:
https://claude.ai/artifact/Aa6c4TddpQwqCHuwz5p5bk

| plik | plansza na kanwie | trasa |
|---|---|---|
| `article.dc.html` | Artykuł (/blog/[slug]) | `/blog/[slug]` |
| `list.dc.html` | Blog: lista artykułów (/blog) | `/blog` |

To pliki Design Component (HTML ze stylami inline). Są źródłem prawdy dla układu, kolejności sekcji,
kolorów, typografii i odstępów. Tłumaczysz je na komponenty Next.js, korzystając z tego, co już jest
(`src/components/site/*`, `grain.module.css`, `FaqList`), a nie kopiujesz runtime'u makiety.

Kolory, fonty i efekt grain są takie same jak w `docs/design/blog-hubs-2026-11/README.md` — tam jest opis.

## Zdjęcia (`/_blob/<id>` → plik)
Te same id co w `docs/design/blog-hubs-2026-11/README.md`; pliki leżą już w `public/hub/`.
Jedno id występuje tylko w makiecie artykułu: `5c1e8716710dcf738cc310e7aff6d56f` (dwa razy) — to
zaślepka zdjęcia w treści; na stronie idą zdjęcia z artykułu (`::photo`), nie ten plik.

## Co jest prawdziwe, a co nie
- Treść przykładowa to artykuł o Norwegii z bazy (`fishing-regulations-norway-2026`), skrócony.
- Zaślepki w nawiasach kwadratowych: `[X] min read`, `[DATE]`, `[PHOTO CAPTION…]`, `[GUIDE QUOTE…]`,
  `[OFFICIAL SOURCE n]`, `[ARTICLE TITLE]`, `[PHOTO: PATAGONIA]` — na stronie idą dane z bazy albo blok się chowa.
- Na liście trzy artykuły z tytułami („When is the fishing season in Iceland?” itd.) są przykładowe — takich wpisów jeszcze nie ma.
- Kafle „Topic hubs” (Regulations / Seasons / Species): osobnych stron nie ma — decyzja tj 23 XI: kafel prowadzi do `/blog?category=…`.
