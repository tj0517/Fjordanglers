---
id: FA-1.97
title: Blog w nowym stylu — strona artykułu i lista wg makiety (grain), spis treści sticky zamiast fixed, FAQ jako sekcja + `FAQPage`
stage: 1
status: review
difficulty: L
model: opus
model_approved:
effort: high
agent: fa-web
branch: feat/fa-1.97-blog-redesign
depends_on: []
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 10
owner: tj
---

# FA-1.97 — Blog w nowym stylu: artykuł i lista

## Kontekst — przeczytaj przed startem
- `CLAUDE.md` — reguły nienegocjowalne
- `docs/03-conventions.md` — konwencje kodu
- `docs/design/blog-2026-11/README.md` + `article.dc.html`, `list.dc.html` — **makieta, źródło prawdy wyglądu**
- `docs/design/blog-hubs-2026-11/README.md` — kolory, fonty, opis efektu grain
- `src/components/site/grain.module.css`, `src/components/site/faq.tsx`, `src/components/site/ui.tsx`, `src/components/site/trip-card.tsx` — wspólne klocki z redesignu hubów; używasz ich, nie piszesz od nowa
- `src/app/(public)/blog/page.tsx`, `src/app/(public)/blog/[slug]/page.tsx` — obecne strony
- `src/components/blog/*` — obecny renderer (`ArticleBody`, bloki `::photo`, `:::info`, `:::warning`, `:::stat`), spis treści, `ArticleRelated`
- `src/lib/blog/article-markdown.ts` — wtyczki remark, `extractSections`
- `docs/tasks/FA-1.83.md`, `FA-1.84.md`, `FA-1.90.md` — jak powstał czytnik, edytor i linkowanie

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
`/blog` i `/blog/[slug]` wyglądają jak reszta strony po redesignie (hub, oferta v2, strona główna): makieta z `docs/design/blog-2026-11/`. Przy okazji naprawiony błąd zgłoszony przez tj: spis treści artykułu ma `position: fixed` na środku ekranu, więc wisi nad hero, treścią i stopką przez całe przewijanie.

## Zakres
- [ ] Odczyt stanu: obecne strony bloga i komponenty z `src/components/blog/`; które klocki z `src/components/site/` pasują do sekcji makiety (lista w raporcie: sekcja makiety → komponent).
- [ ] **Strona artykułu** wg `article.dc.html`, w kolejności makiety: hero (okruszki Home › Journal › kraj › tytuł, kategoria + kraj, H1, lead = `description`, autor/data/czas czytania), kolumna „In this article” + treść, sekcja FAQ, linki/stopka artykułu („Written by … · Published …”), „Fish it with a guide” (oferty z kraju), CTA huba na grainie, „More from the Journal”.
- [ ] **Spis treści:** kolumna obok treści, `position: sticky` pod pływającą nawigacją; zaczyna się pod hero i kończy razem z treścią artykułu — nie wchodzi na hero, sekcje pod artykułem ani stopkę. Mobile: jak dziś (zwijany). Obecny `fixed` usunięty.
- [ ] **Bloki w treści w nowym stylu:** `:::info` → „Good to know”, `:::warning` → „Important”, `:::stat` → blok na grainie, `::photo` z podpisem — wygląd z makiety. Składnia markdownu **bez zmian** (artykuły w bazie muszą renderować się tak samo).
- [ ] **Nowe dyrektywy** (renderer; edytor dostaje je w FA-1.98):
  - `:::summary` … `:::` → ramka „In short” z makiety,
  - `::quote{text="…" guide="…" region="…"}` → cytat przewodnika z makiety.
  Nieznane/niepełne dyrektywy nie wywalają strony (zachowanie jak dziś dla błędnych bloków).
- [ ] **FAQ:** sekcja `## FAQ…` (nagłówek H2 zaczynający się od „FAQ” albo „Frequently Asked Questions”) z pytaniami `###` wyjmowana z treści i renderowana jako osobna sekcja z makiety (grain, numerowane pytania, `FaqList` jeśli pasuje) + schema `FAQPage` w JSON-LD z tymi samymi pytaniami i odpowiedziami. Artykuł bez takiej sekcji: bez bloku i bez schemy.
- [ ] **Lista `/blog`** wg `list.dc.html`: wyróżniony najnowszy wpis, kafle „Topic hubs” → `/blog?category=Regulations|Seasons|Species`, „All articles” z filtrem kategorii i kraju, kafle destynacji (linki do hubów), CTA „Plan your trip”. Filtrowanie po stronie klienta na pełnej liście (wpisów jest kilka) — strona zostaje statyczna/ISR, canonical zawsze `/blog`, parametr tylko ustawia filtr początkowy. Porównanie kategorii bez rozróżniania wielkości liter (kategoria to wolny tekst, FA-1.84 C3). „Load more” tylko gdy wpisów > 12.
- [ ] Zaślepki z makiety (`[X] min read`, `[DATE]`, cytat itd.) nigdy nie trafiają na stronę: brak danych → blok się chowa.

## Gotowe, gdy
- [ ] Zrzuty (desktop 1440 i mobile 390) `/blog` i `/blog/fishing-regulations-norway-2026` obok odpowiednich plansz makiety — wklejone.
- [ ] Spis treści: zrzuty w trzech położeniach przewijania (nad hero / w środku treści / przy stopce) — w pierwszym i trzecim go nie widać nad hero/stopką.
- [ ] Artykuł o Norwegii renderuje wszystkie dotychczasowe bloki (`::photo`, `:::info`, `:::warning`, `:::stat`, tabela) — test renderera zielony, bez zmian w `body_md` w bazie.
- [ ] Test: markdown z `:::summary` i `::quote{…}` daje oba bloki; `::quote` bez `text` nie wywala renderu (red proof).
- [ ] Test: sekcja FAQ wyjęta z treści + JSON-LD `FAQPage` ma tyle pytań, ile `###` w sekcji; artykuł bez FAQ → brak `FAQPage` (red proof). JSON-LD z artykułu o Norwegii wklejony.
- [ ] `/blog?category=seasons` pokazuje tylko wpisy z kategorią „Seasons”; `<link rel="canonical">` = `/blog` — wklejone.
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` zielone — wklejone.

## Poza zakresem
- Edytor, upload zdjęć w treści, kolumny autora i „Last checked” → FA-1.98 (tu stopka artykułu pokazuje „FjordAnglers” i datę publikacji/aktualizacji jak dziś).
- Osobne strony „Topic hubs” → później, gdy będzie ≥ 5 wpisów w kategorii.
- Link „Report an outdated rule” → FA-1.98.
- Zmiany w hubach, ofertach, nawigacji i stopce strony.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
brak

## Weryfikacja
```
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

## Notatki z realizacji
- **2026-11-23, tj:** makieta artykułu i listy zaakceptowana (kanwa Claude Design, plansze „Artykuł” i „Blog: lista artykułów”), skopiowana do `docs/design/blog-2026-11/`.
- **2026-11-23, tj:** spis treści ma zatrzymywać się na treści (sticky w kolumnie), nie wisieć nad hero i stopką.
- **2026-11-23, tj:** „Topic hubs” → `/blog?category=…`, bez nowych stron; FAQ jako sekcja + `FAQPage`; nowe dyrektywy `:::summary` i `::quote{…}`.
- **2026-11-23, agent (odczyt stanu, prod SELECT):** opublikowane wpisy: `best-time-to-fly-fish-new-zealand` (Seasons, New Zealand) i `fishing-regulations-norway-2026` (**Planning**, Norway — nie „Regulations” jak w makiecie). Oba mają `## FAQ – Frequently Asked Questions…` z `###` pytaniami i po nim `## Useful Links…`; odpowiedzi FAQ w Norwegii zawierają Markdown (pogrubienia, kursywa, jedna lista). `/blog` jest dziś `force-dynamic` (FA-1.83), nie statyczna/ISR.
- **2026-11-23, tj (decyzje przed startem):**
  - T1 → podmienić asercje wyglądu: w `table-of-contents.test.tsx` `width:150px` + `left:max(…)` (geometria `fixed` — test jednak sprawdzał pozycjonowanie) → asercje sticky / brak `position:fixed`; w `article-body.test.tsx` `'Note: '`, `#1B4F72`, `clamp(40px` → nowy wygląd. Asercje zachowania bez zmian.
  - T2 → odpowiedzi FAQ artykułu renderowane jako Markdown (FaqList przyjmuje opcjonalnie gotową treść odpowiedzi; hub/oferta/główna podają string jak dziś); `FAQPage.acceptedAnswer.text` = czysty tekst (bez znaczników, punkty listy w osobnych liniach).
  - T3 → kafel „Topic hubs” tylko dla kategorii z ≥ 1 wpisem (bez rozróżniania wielkości liter); sekcja znika, gdy żaden.
  - T4 → chipy filtrów z danych (kategorie i kraje opublikowanych wpisów).
  - T5 → siatka „All articles” = pełna lista (z wyróżnionym), filtr działa na całości.
  - T6 → `/blog` zostaje `force-dynamic`; serwer czyta `?category`/`?country` tylko jako filtr początkowy (HTML od razu przefiltrowany), klient filtruje dalej; canonical zawsze `/blog`.
  - T7 → `ReadingProgress` usunięty (nie ma go w makiecie, ten sam problem co `fixed` TOC).
  - T8 → bez osobnej sekcji przewodników pod artykułem; `TripCard` z linią „Guide: …” jak na stronie oferty. Część `guides` z `getArticleRelated` (FA-1.90) usunięta z warstwy danych i testów (reguła 9).
- **2026-11-23, agent — plan (zamiast osobnego przebiegu fa-architect):**
  1. `src/lib/blog/article-markdown.ts`: nowe dyrektywy — `:::summary` (kontener, Markdown w środku) → `dataBlock: 'summary'`, sekcja „In short” w spisie treści (id `in-short`); `::quote{text guide region}` (liść) → `dataBlock: 'quote'` tylko z niepustym `text`, inaczej tekst jak wpisano (jak błędne `::photo`). Etykiety `:::info`/`:::warning` → „Good to know. ” / „Important. ”. Składnia istniejących dyrektyw bez zmian. FAQ: na poziomie głównym H2 (depth 2) zaczynające się od `FAQ` albo `Frequently Asked Questions` (bez wielkości liter) do następnego nagłówka depth ≤ 2; pytania = `###`, odpowiedź = źródło między pytaniami; tekst przed pierwszym `###` = intro. Wtyczka zastępuje sekcję jednym znacznikiem `dataBlock: 'faq'` w tym samym miejscu (FAQ stoi przed „Useful Links” jak w makiecie), ale nadal zużywa `uniqueId` na wszystkich nagłówkach sekcji — id późniejszych nagłówków bez zmian względem dziś. `extractSections` zwraca pozycję FAQ z id nagłówka. `extractArticleFaq(md)` → `{ id, title, intro, entries: { question, answerMd, answerText }[] } | null`. Opcja wtyczki dla odpowiedzi FAQ: bez leadu i bez wycinania FAQ.
  2. `src/lib/seo/faq-jsonld.ts`: `buildFaqPageJsonLd(entries)` → obiekt albo `null` dla pustej listy; `hub-jsonld.ts` go używa (wynik identyczny, test hubu bez zmian).
  3. `article-body.tsx` + `article-blocks.tsx`: typografia i bloki z `article.dc.html` (p 18/1.7 `#33485C`, lead 21, h2 Fraunces 32, h3 20, tabela w kremowej ramce, info/warning z ikoną, stat na `s.blur s.fjord`, zdjęcie 16:10 z podpisem, nowe `SummaryBox`, `GuideQuote` na `s.blur s.guide`, `ArticleFaq` na `s.blur s.iceland` z `SectionHeading` + `FaqList`). `ArticleBody` sam wylicza FAQ z Markdownu, więc podgląd w edytorze też pokazuje blok.
  4. `table-of-contents.tsx`: desktop (lg+) kolumna `aside` rozciągnięta na wysokość treści, w niej `position: sticky` pod nawigacją; linki z lewą kreską (aktywny łosoś), etykiety przycięte do 2 linii + `title`. Mobile: zwijany jak dziś. Bez `fixed`.
  5. `blog/[slug]/page.tsx` w kolejności makiety: hero (okruszki, tagi, H1, lead, meta, zdjęcie 5:4) → TOC + artykuł (treść, FAQ w miejscu, stopka „Written by FjordAnglers · Published …”) → „Fish it with a guide” (`TripCard`, `relatedTripsHeading`, link „All {kraj} trips” → `/trips?country=`) → CTA huba (grain, gdy jest hub) → „More from the Journal” (do 3 innych wpisów, bez bieżącego). JSON-LD: Article + Breadcrumb jak dziś + `FAQPage`, gdy jest FAQ. Jeden `<main>`.
  6. `blog/page.tsx` (force-dynamic, filtr początkowy z `searchParams`) + klientowy `BlogList`: nagłówek, wyróżniony najnowszy na grainie, „Topic hubs” (T3), „All articles” z chipami (T4/T5) i „Load more” > 12, kafle destynacji (`DESTINATION_HUBS`, Patagonia granatowa bez zdjęcia), CTA „Plan your trip”.
  7. Testy: dyrektywy (+ red proof `::quote` bez `text`), FAQ + `FAQPage` (+ red proof bez FAQ), filtr listy (bez wielkości liter), aktualizacja testów TOC / ArticleRelated / internal-links.

- **2026-11-23, agent — raport (status `review`; `done` ustawia tj):**

  ## Report — FA-1.97 Blog redesign: article and list (grain), sticky table of contents, FAQ section + `FAQPage`
  
  Task: `docs/tasks/FA-1.97.md` · branch `feat/fa-1.97-blog-redesign` · tj decisions T1–T8 and the plan are in the task's "Notatki z realizacji".
  Proof files are in `.fa-proofs/FA-1.97/` (untracked, on tj's machine).
  
  ### Done
  - **Article page `/blog/[slug]` follows `article.dc.html`, in the mockup's order:**
    - hero: breadcrumb Home › Journal › country (a link to the hub) › title, tags, H1, lead, "FjordAnglers · date · N min read", 5:4 photo;
    - "In this article" + the body;
    - FAQ, in place in the body;
    - "Written by FjordAnglers · Published …";
    - "Fish it with a guide" (`TripCard`);
    - the hub's CTA on grain;
    - "More from the Journal".
    - Evidence: `compare-article-desktop.png`, `compare-article-mobile.png`, and crops `article-faq-desktop.png`, `article-stat-desktop.png`, `article-table-desktop.png`, `m-article-*.png`.
    - Blocks with no data are hidden, not filled: the hero badge, the guide quote and "In short" (neither post uses the directive), "Last checked", "Report an outdated rule", "Ask us directly". None of the mockup's `[X]` / `[DATE]` / `[GUIDE…` / `[PHOTO…` placeholders appears in the HTML (regex check on both articles: `False`).
  - **List `/blog` follows `list.dc.html`:**
    - newest post featured on grain;
    - "Topic hubs" only for categories that have posts (T3) — today one tile, Seasons;
    - "All articles" with chips from the data (T4), a grid of the full list (T5), and "Load more" only above 12 posts;
    - destination tiles (Patagonia navy, no photo);
    - "Plan your trip" on grain.
    - Evidence: `compare-blog-desktop.png`, `compare-blog-mobile.png`.
  - **Table of contents is `position: sticky` in a column as tall as the article, not `fixed`.** Measured at 1440×900 (`toc-positions.json`, shots `toc-1-hero.png` … `toc-4-footer.png`):
    - top of page: TOC top 663, below the hero's bottom (591) — it does not sit on the hero;
    - mid-article: TOC top 96, stuck under the nav;
    - end of the article: TOC bottom 349 = article bottom 349, and "Fish it with a guide" starts at 421 — it stops with the article;
    - footer in view: TOC at −1644…−1251, off-screen — not over the footer.
    - Mobile: the collapsible card as before (`m-article-2-toc-card-open.png`). Horizontal overflow at 390 px is 0 px on both pages.
  - **Existing blocks render without any change to `body_md`.**
    - Local Norway body md5 = prod `1d885e79f52ae3f2c036786a4597ad4e`.
    - Rendered from the local copy: 3 × `::photo` (Atlantic cod, Brown trout, Atlantic salmon — all images load), `:::info` → "Good to know.", `:::warning` → "Important.", `:::stat` "15 kg / marine fish per person", and the table (4 rows).
    - `article-body.test.tsx`: 25/25.
  - **New directives `:::summary` ("In short") and `::quote{text guide region}`** are covered by tests. Red proof below.
  - **FAQ section is cut from the body and rendered as the grain block.** Answers are rendered as Markdown (T2). The `FAQPage` answer is plain text with list items on their own lines.
    - The heading IDs after the FAQ are unchanged: `useful-links-official-resources` is present.
    - Norway: 6 `###` in the FAQ section = 6 questions in `FAQPage`. NZ: 6 = 6.
  - **`buildFaqPageJsonLd` is shared by the hub and the article.** `hub-jsonld.test.ts` is unchanged and green (5/5).
  - **`/blog?category=seasons` shows only the Seasons post; canonical is `/blog`.**
  - **Removed (rule 9):** `ReadingProgress` (T7); the guides part of `getArticleRelated`, plus its type and tests (T8 — the trip card prints "Guide: …").
  
  ### Not done
  - **Local `pnpm build`.** Not run. Per `docs/05-agent-operations.md` §9, the build is proven by the CI `check` job on this PR (link below), so the local stack did not have to be stopped.
  - **`pnpm test` is not fully green locally.** 2 tests in `src/lib/guide-requests/__tests__/guide-requests.test.ts` fail.
    - They fail identically on a clean `origin/main` worktree (`6379dcb`) against the same local DB.
    - Cause: the local DB has migration `20261122000000` applied (FA-M.05, PR #211, not on `main`).
    - This is environment, not this diff. CI `db` resets from `main`'s migrations.
  
  ### Noticed, not touched (→ docs/deferred-tasks.md)
  - The footer's Journal column links every topic to `/blog`. It could now use `?category=` (the site footer is out of scope).
  - The admin editor preview does not pass the post's country to `ArticleBody`, so the FAQ fallback intro line is missing there (FA-1.98).
  - The untracked `.fa-proofs/FA-1.92/*.cjs` scripts make a local `pnpm lint` exit 1 (10 `no-require-imports`). CI does not see them.
  
  ### Needs a decision
  - **Norway is categorised "Planning", not "Regulations"** (the mockup shows Regulations). So the "Regulations" topic tile is hidden today (T3). Recategorising is a data change in the editor, on prod, by tj — not done here.
  - **Small calls the implementer made that the plan did not settle** (each easy to change):
    - the topic tile says "See the articles", not "Open the hub" (there is no hub page);
    - the TOC entry for the FAQ reads "FAQ", as in the mockup;
    - country chips have no "All" chip — clicking the active chip clears it;
    - "Load more" keeps the mockup's salmon border.
  - **Test assertions changed beyond the T1 list.** Each is a look-only value from the mockup:
    - lead `font-size:20px` → `21px`;
    - warning accent `#E67E50` → `#C4561F`;
    - `'Important: '` → `'Important. '` (also in `blog-post-form.test.tsx`).
    - The behaviour assertions are unchanged.
  
  ### Verification
  ```
  $ pnpm typecheck
  $ tsc --noEmit                                   → exit 0
  
  $ pnpm lint --ignore-pattern '.fa-proofs/**'      (what CI sees; plain `pnpm lint` errors only in untracked .fa-proofs/FA-1.92/*.cjs)
  ✖ 91 problems (0 errors, 91 warnings)            → exit 0
  $ eslint <every file changed on this branch>      → no output, exit 0
  
  $ pnpm vitest run   (full suite, local)
  Test Files  1 failed | 184 passed (185)
   FAIL guide-requests.test.ts > createGuideRequest > sets the inquiries summary …      (same 2 on clean origin/main, see "Not done")
   FAIL guide-requests.test.ts > withdrawGuideRequest > kills the link …
  
  $ pnpm vitest run <blog, seo, internal-links, blog pages, blog-post-form>   (blog-tests.log)
  Test Files  15 passed (15)
       Tests  152 passed (152)
  
  $ pnpm knip                                       → exit 0, no findings
  
  $ pnpm build                                      → CI `check` job on this PR (link in PR checks)
  ```
  
  Red proof — `::quote` without `text` (guard `child.name === 'quote' && quote !== ''` → `child.name === 'quote'`):
  ```
   FAIL  article-body.test.tsx > … > a ::quote without text does not throw and shows what was typed — it is not a quote block
  AssertionError: expected '<div class="_body_11d61d"><figure cla…' to contain 'quote{guide='
        Tests  1 failed | 24 passed (25)
  restored → Tests  25 passed (25)
  ```
  
  Red proof — no FAQ → no `FAQPage` (removed `if (entries.length === 0) return null` in `faq-jsonld.ts`):
  ```
   FAIL  article-faq.test.tsx > the FAQPage built from it > a body without FAQ gives no FAQPage   — expected { …(3) } to be null
   FAIL  faq-jsonld.test.ts > buildFaqPageJsonLd > no entries, no FAQPage …                       — expected { …(3) } to be null
   FAIL  hub-jsonld.test.ts > buildHubJsonLd (FA-1.82) > FAQPage only when the hub has FAQ       — expected { …(3) } to be null
        Tests  3 failed | 21 passed (24)
  restored → Tests  24 passed (24)
  ```
  
  `/blog?category=seasons` (local dev on the local stack; both prod rows copied there, body md5s equal to prod):
  ```
  status: 200
  canonical: ['https://www.fjordanglers.com/blog']
  All articles cards: ['/blog/best-time-to-fly-fish-new-zealand']
  pressed chips: ['Seasons']
  /blog (no filter) All articles: ['/blog/best-time-to-fly-fish-new-zealand', '/blog/fishing-regulations-norway-2026'], canonical /blog
  ```
  
  JSON-LD on `/blog/fishing-regulations-norway-2026`: types `WebSite, Organization+LocalBusiness, Article, BreadcrumbList, FAQPage`. The full `FAQPage` is in `norway-faqpage.json`; it begins:
  ```json
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      { "@type": "Question",
        "name": "Exactly how many kilograms of fish can I export from Norway in 2026?",
        "acceptedAnswer": { "@type": "Answer", "text": "In 2026, the tourist limit is exactly 15 kg of marine fish or processed products (e.g., fillets) per person. … drop to 10 kg!" } },
      …6 questions in total; the list answer reads:
      "Yes, Norway has exceptions to protect specific populations:\nCod in the Oslofjord: There is a total, year-round ban …\nHalibut: Any specimen measuring over 2 meters …\nKing crab and bluefin tuna: …"
    ]
  }
  ```
  
  Database: no writes to production. Prod reads (SELECT): the published rows, their bodies and their md5s (Norway `1d885e79…`, NZ `56e0bfe4…`). The NZ row was copied into the **local** DB only, for the screenshots (`INSERT 0 1`, md5 checked equal before the insert). Trackers in the browser were blocked (`ERR_BLOCKED_BY_CLIENT` for googletagmanager in the console log).

- **2026-11-23, tj (review PR #212):** przyjęte z uzupełnieniami; rozszerzenie zakresu — „Guide: {imię}” na karcie oferty pod artykułem linkuje do publicznego profilu przewodnika (FA-1.86); reszta diffu i drobne wybory bez zmian; kategorii Norwegii nie zmieniamy (dane na prod, tj). Status zostaje `review`.
- **2026-11-23, agent — raport po review (runda 1):**

  ## Report — FA-1.97, after tj's review (round 1): "Guide:" links to the guide's profile
  
  Scope extension from tj (23 XI): under an article, the trip card's "Guide: {name}" links to the guide's profile. This restores the article → profile links that FA-1.90 added and T8 removed. Nothing else in the accepted diff was touched; the Norway category is unchanged.
  
  ### Done
  - **The FA-1.86 visibility rule, read from code:**
    - `getGuide()` serves only `status = 'active'` and `is_hidden = false` (`src/lib/supabase/queries.ts:249–262`).
    - A profile has a URL only with a slug (`guideProfilePath`).
    - It is indexable only with ≥ 1 active offer (`generateMetadata` noindex in `src/app/(public)/guides/[id]/page.tsx:114–117`; the same rule in `src/app/sitemap.ts:80–83`).
    - Under an article the card **is** an active offer of that guide (`relatedPagesByTier` filters `experience_pages.status = 'active'`), so the offer half holds by construction. The rule is `publicGuideSlug()` in `src/lib/guide-url.ts`: active + not hidden + non-blank slug, otherwise `null`. Missing columns also give `null`, never a guess.
  - **No new query.**
    - `RELATED_SELECT` already embedded the guide; it now also reads `slug, status, is_hidden`.
    - `relatedPagesByTier` maps each row to `guide: { id, full_name, publicSlug }`, so the status columns stop in the data layer. This also replaced the old `as unknown as` cast.
    - Prod read confirming anon may read those columns and RLS returns every guide row (so the rule must be applied in code):
      ```
      has_column_privilege('anon','public.guides', c,'SELECT'): id, full_name, slug, status, is_hidden → all true
      pg_policies guides SELECT: "Public reads all guides" qual = true; "Public reads active guides" qual = ((status='active' OR verified_at IS NOT NULL) AND is_hidden=false)
      ```
  - **`TripCardData.guideSlug?: string | null`.**
    - With a slug, the guide line renders `<Link href="/guides/{slug}">`; without one, it is text as before.
    - The line is its own `<p>`, outside the card's photo link and "View trip" link. A test asserts no `/guides/` href sits inside an `/experiences/` anchor.
  - **Only `article-related.tsx` passes the slug** (`page.guide?.publicSlug ?? null`). The hub, offer v2 "More trips", `/trips` and guide-profile cards do not.
  - **`CACHE_TAG_GUIDES` stays** on `getArticleRelated` (`queries.ts:1639`: `tags: [CACHE_TAG_EXPERIENCES, CACHE_TAG_GUIDES, CACHE_TAG_BLOG]`). Hiding or renaming a guide revalidates the link.
  
  ### Not done
  - **The link target cannot be shown rendering locally.**
    - `/guides/hana-seed-new-zealand` returns 500 on a local run. The cause is unrelated to this branch: `getLandscapeUrl` builds the cover from `NEXT_PUBLIC_SUPABASE_URL` (`127.0.0.1:54421` locally), and that host is not in `next.config` `images`.
    - This branch changes neither the profile page nor `next.config`. The guide was found (a hidden or unknown one would be a `notFound()` 404); the error is thrown in render.
    - Added to deferred-tasks.
  
  ### Noticed, not touched (→ docs/deferred-tasks.md)
  - Every guide profile 500s on `next dev` against the local stack (above): `src/lib/landscapes.ts`, `next.config.ts`.
  
  ### Needs a decision
  - none
  
  ### Verification
  Tests (`src/lib/__tests__/guide-url.test.ts` new, `src/components/experience-v2/offer-more-trips.test.tsx` new, `article-related.test.tsx` and `internal-links.test.tsx` extended):
  - card with a public slug → `<a href="/guides/public-guide">Public Guide</a>`; without one → `Guide: Private Guide`, no link;
  - data layer → card: guides `public` / `is_hidden: true` / `status: 'pending'` → `publicSlug` = `['guide-public', null, null]`, only `/guides/guide-public` in the HTML, and the hidden and pending guides as text; a guide with no slug → text;
  - the guide object leaving the data layer has exactly `full_name, id, publicSlug`;
  - offer page "More trips" gets data **with** `publicSlug` set and still has no `/guides/` link;
  - hub: `destination-hub-view.test.tsx` is unchanged and green (19/19). Its existing assertion that every `<a>` in a hub card points to `/experiences/<slug>` covers "no guide link on the hub".
  
  ```
  $ pnpm vitest run guide-url article-related internal-links offer-more-trips destination-hub-view
  Test Files  5 passed (5)      Tests  48 passed (48)
  ```
  
  Red proof — `publicGuideSlug` without the hidden check (`|| guide.is_hidden !== false` removed):
  ```
   FAIL  guide-url.test.ts > publicGuideSlug > hidden: null (getGuide() serves no hidden profile — the link would be a 404)
  AssertionError: expected 'josh-hart-new-zealand' to be null
   FAIL  internal-links.test.tsx > getArticleRelated > FA-1.97 (tj review): a trip card links its guide only when the profile is public — active, not hidden, with a slug
  AssertionError: expected [ Array(3) ] to deeply equal [ 'guide-public', null, null ]
        Tests  2 failed | 16 passed (18)
  restored → Tests  18 passed (18)
  ```
  
  Local HTML `/blog/best-time-to-fly-fish-new-zealand` (dev on the local stack; local offer `seed-backcountry-day-nz`, guide Hana Seed: `active`, `is_hidden = f`, slug `hana-seed-new-zealand`):
  ```
  heading: ['Trips in New Zealand']
  Guide line: Guide: <a style="color:#0A2E4D;text-decoration:underline;text-decoration-color:#E67E50;text-underline-offset:3px" href="/guides/hana-seed-new-zealand">Hana Seed</a>
  all /guides/ hrefs on the page: ['/guides/hana-seed-new-zealand']
  ```
  
  Gates:
  ```
  pnpm typecheck                                  → exit 0
  pnpm lint --ignore-pattern '.fa-proofs/**'       → 0 errors, 91 warnings, exit 0
  pnpm knip                                       → exit 0
  pnpm vitest run (full)                          → Test Files 1 failed | 186 passed (187); Tests 2 failed | 2302 passed
                                                    the 2 = guide-requests.test.ts, same as round 0 (local DB has FA-M.05's migration; clean origin/main fails them identically)
  ```
  
  CI on the round-0 head (`18ed307`), run 45219706323: check (incl. `pnpm build`) pass · db pass · knip pass · secrets pass. CI for this commit: see the PR checks.
  Status stays `review`; tj sets `done` after merge.
