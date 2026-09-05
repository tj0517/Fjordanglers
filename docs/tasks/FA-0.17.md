---
id: FA-0.17
title: Copy przestaje obiecywać wyłącznie Skandynawię
stage: 0
status: in_progress
difficulty: M
model: sonnet
model_approved:
effort: medium
agent: fa-core
branch: fix/copy-beyond-nordics
depends_on: [FA-0.12]
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 4
owner: tj
---

# FA-0.17 — Copy przestaje obiecywać wyłącznie Skandynawię

**Skąd to zadanie (audyt lejka 5 IX 2026, kontynuacja FA-0.12).** FA-0.12 naprawiło stopkę,
`/trips` i cross-sell jako *dane i konfigurację* — kraj, region, tytuł strony. Zostaje osobna
warstwa: copy, które niezależnie od tych mechanizmów wprost obiecuje wyłącznie Norwegię,
Szwecję, Islandię i Finlandię — na stronie głównej, w FAQ, w prefillu WhatsAppa, w
domyślnych metadanych `layout.tsx` i na `/guides`/`/blog`. Amerykanin z reklamy Patagonii,
który trafia na `/`, klika "Talk to an Expert" albo czyta FAQ, widzi obietnicę zasięgu, którą
firma już złamała (ma aktywne strony w Argentynie, Chile i Nowej Zelandii).

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`; `docs/03-conventions.md`
- `docs/tasks/FA-0.12.md` — co już naprawione (stopka, `/trips` metadata, cross-sell, tytuł,
  `keywords` w `experiences/[slug]` i `/trips`) — nie liczyć drugi raz, nie cofać
- `src/lib/countries.ts` — `COUNTRY_REGION`/`getRegionGroup()` z FA-0.12, źródło prawdy o
  regionach, jeśli Faza 2 czegoś takiego potrzebuje
- `src/lib/ai/inquiry-agent.ts:40` — poprawna lista krajów (wzorzec dla Fazy 1 punkt B)
- `src/lib/ai/extract-trip.ts:79` — lista krajów bez Patagonii (naprawione w Fazie 1, patrz niżej)

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Serwis przestaje komunikować, że FjordAnglers działa wyłącznie w Skandynawii. Nie jest to
repozycjonowanie marki ani redesign — to usunięcie sprzeczności między tym, co sprzedajecie
(Nordyk + Patagonia + Nowa Zelandia), a tym, co strona, FAQ, WhatsApp i metadane obiecują.

## Zakres

### Krok 0 — ten plik
Utworzony w tej sesji wg `docs/tasks/README.md` i wzorca `FA-0.12.md`.

### Faza 1 — inwentaryzacja (ZERO zmian copy poza punktem B)

- [x] **Odczyt bieżącego stanu (kod)**:
      ```
      grep -rn "Scandinavia\|Scandinavian\|Nordic\|Norway, Sweden\|Norway and Sweden" src \
        --include=*.tsx --include=*.ts | grep -v "src/emails/"
      ```
      Wynik: **58 trafień**, nie 51 jak w odczycie tj z 5 IX. Różnica: +7, z jednego źródła —
      FA-0.12 (zmergowane po 5 IX) wprowadziło nowy, poprawny kod zawierający dosłowne słowo
      "Nordic" jako wartość enuma/komentarz, którego 5 IX nie było: `COUNTRY_REGION` w
      `countries.ts` (6 wpisów `'Nordic'` + 1 komentarz), oraz komentarze/użycia `neutralTagline`
      w `experiences/[slug]/page.tsx`, `(public)/layout.tsx`, `trips/page.tsx`, `queries.ts`
      (8 miejsc). Pełna surowa lista wklejona w raporcie.
- [x] Każde trafienie zaklasyfikowane do koszyka A–E — tabela w raporcie.
- [x] **Koszyk B naprawiony od razu**: `src/lib/ai/extract-trip.ts:79` `SYSTEM_PROMPT`
      wyrównany z `src/lib/ai/inquiry-agent.ts:40` — lista krajów identyczna: "Iceland, Norway,
      Sweden, Finland, New Zealand, and Patagonia (Argentina & Chile)". Sprawdzone: nie ma
      trzeciego promptu z własną listą krajów (`grep -rln "Norway\|Iceland\|Patagonia" src/lib/ai/
      src/actions/` → tylko te dwa pliki + `stripe-connect.ts`, gdzie to tabela kodów walut/krajów
      dla Connect, nieużywana funkcjonalność wg ADR-0001, nie lista krajów obsługi).
- [x] `pnpm typecheck && pnpm test -- --run` zielone po zmianie w punkcie B.

### STOP — bramka copy (tu jesteśmy)
Faza 1 skończona. Czekam na brzmienie dla każdej pozycji koszyka A (albo decyzję "zostaje bez
zmian") — patrz raport, sekcja "Needs a decision".

### Faza 2 — podmiana (PO decyzji tj, nie zaczęta)
- [ ] Podmienić wyłącznie zatwierdzone teksty, dosłownie.
- [ ] Zero zmian w strukturze/layoucie/klasach — diff samych stringów.
- [ ] Jeśli zatwierdzony tekst łamie layout — STOP, zrzut, pytanie.
- [ ] `pnpm typecheck && pnpm test -- --run && pnpm build` zielone; `pnpm lint` bez nowych błędów.
- [ ] Status `review` tu i w `INDEX.md`.

## Gotowe, gdy
(uzupełniane w Fazie 2, po decyzji tj o brzmieniu — nie da się zdefiniować "poprawnego tekstu"
przed tą decyzją)
- [ ] Każda pozycja koszyka A ma albo nowe, zatwierdzone brzmienie w kodzie, albo jawną notatkę
      "zostaje bez zmian, decyzja tj [data]".
- [ ] `grep` z Fazy 1 uruchomiony ponownie — każde pozostałe trafienie da się przypisać do
      koszyka C, D lub E (nic "zapomnianego" w A).
- [ ] `pnpm typecheck && pnpm test -- --run && pnpm build` zielone; `pnpm lint` bez nowych błędów.

## Poza zakresem
- Redesign czegokolwiek — zmieniamy stringi, nie komponenty.
- `src/emails/*`, panel admina, `/offers`, guide dashboard.
- Tłumaczenia i wersje językowe.
- Treść artykułów blogowych (`src/lib/blog-data.ts`, `blog-content/*`) — osobny temat redakcyjny.
- Zmiana nazwy marki. "FjordAnglers" zostaje — decyzja, której nie podejmuję i nie proponuję.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- **Koniec Fazy 1 — bezwarunkowy STOP** na decyzję tj o brzmieniu każdej pozycji koszyka A.
  Żadna pozycja nie jest "oczywista i niewymagająca decyzji".
- Jakakolwiek zmiana w `src/lib/blog-data.ts` lub `blog-content/` — STOP, treść redakcyjna.
- Zmiana schema.org poza listą krajów (typ encji, `sameAs`, `aggregateRating`) — STOP.
- `touches_db: false`, `touches_prod: false` — żadnych odczytów ani zapisów bazy w tym zadaniu.
- Pliki, które FA-0.12 już zmieniło, nietykane w tym zadaniu, chyba że tj wskaże je jawnie.

## Weryfikacja
```
grep -rn "Scandinavia\|Scandinavian\|Nordic\|Norway, Sweden\|Norway and Sweden" src \
  --include=*.tsx --include=*.ts | grep -v "src/emails/"
pnpm typecheck && pnpm test -- --run && pnpm build
pnpm lint
```

## Notatki z realizacji (2026-09-06)

## Report — FA-0.17 Copy przestaje obiecywać wyłącznie Skandynawię (Faza 1)

### Done

- **Task file + INDEX.md row** utworzone (Krok 0).
- **Grep bazowy uruchomiony**, surowe wyjście (58 trafień, nie 51 — wyjaśnienie różnicy poniżej):

```
src/app/layout.tsx:28:    default: 'FjordAnglers — Guided Fishing Trips in Nordic Countries',
src/app/layout.tsx:32:    'Book guided fishing trips in Norway, Sweden, Iceland & Finland with verified local guides. Salmon, sea trout, pike & fly fishing. Free to browse — only pay when you confirm.',
src/app/layout.tsx:35:    'fishing guide Scandinavia', 'sea trout fishing Sweden', 'Nordic fishing guide',
src/app/layout.tsx:44:    title: 'FjordAnglers — Guided Fishing Trips in Nordic Countries',
src/app/layout.tsx:45:    description: 'Book guided fishing trips in Norway, Sweden, Iceland & Finland with verified local guides. Salmon, trout, pike & more.',
src/app/layout.tsx:46:    images: [{ url: '/brand/og-default.png', width: 1200, height: 630, alt: 'FjordAnglers — Guided Fishing Trips in Nordic Countries' }],
src/app/layout.tsx:50:    title: 'FjordAnglers — Guided Fishing Trips in Nordic Countries',
src/app/layout.tsx:51:    description: 'Book guided fishing trips in Norway, Sweden, Iceland & Finland. Salmon, trout, pike & fly fishing.',
src/app/layout.tsx:119:              description: 'Guided fishing trips marketplace connecting Central European anglers with verified local guides across Norway, Sweden, Iceland and Finland.',
src/app/layout.tsx:141:              knowsAbout: ['Salmon fishing', 'Sea trout fishing', 'Fly fishing', 'Nordic fishing guides', 'Pike fishing'],
src/app/page.tsx:89:        <Image src="/hero.jpg" alt="Angler fishing on a Nordic fjord river at midnight sun" fill priority className="object-cover object-center" />
src/app/page.tsx:114:            Guided fishing in the Nordic countries
src/app/page.tsx:129:            Guided fishing trips across Norway, Sweden, Iceland and Finland — hand-picked local guides, real rivers, no tourist routes.
src/app/page.tsx:149:                title: 'Curated Nordic Guides',
src/app/page.tsx:155:                desc:  'Norway, Sweden, Iceland and Finland. The best salmon, trout and sea fishing in Europe, curated in one place.',
src/app/page.tsx:220:                  FjordAnglers started because we went through the same thing you're going through. We've been backpacking Norway, Sweden, and Iceland with rods, sleeping in tents — and the hardest part was never the fishing. It was knowing where to go. Hundreds of rivers, lakes, and coastlines, and no straightforward way to find someone local who actually knows them. So we started building that list ourselves.
src/app/page.tsx:302:                  Norway, Sweden, Iceland and Finland — same process everywhere.
src/app/offers/[token]/page.tsx:541:            FjordAnglers · Connecting guides &amp; anglers across Scandinavia
src/app/admin/inquiries/[id]/LocationPicker.tsx:210:  const defaultCenter: [number, number] = [65, 14] // centre of Scandinavia
src/app/guide-intake/[token]/page.tsx:89:          FjordAnglers · Connecting guides &amp; anglers across Scandinavia
src/app/experiences/[slug]/page.tsx:75-76: (comment, FA-0.12 explaining the keywords override)
src/app/experiences/[slug]/page.tsx:1612:      <SiteFooter neutralTagline={pageRegion !== 'Nordic'} />
src/app/about/page.tsx:9:  description: 'FjordAnglers was built by three Polish anglers who backpacked Norway, Sweden and Iceland with a rod. We only list guided fishing trips we'd book ourselves.',
src/app/about/page.tsx:105:                We're students from Gdańsk who've been backpacking Nordic countires every summer we could - with rods, sleeping in tents...
src/app/(public)/layout.tsx:10-11: (comment, FA-0.12 explaining neutralTagline decision)
src/app/trips/page.tsx:94:const DEFAULT_DESCRIPTION = 'Browse 20+ hand-picked guided fishing trips across Norway, Sweden, Iceland and Finland. Salmon, sea trout, pike & fly fishing. Filter by country.'
src/app/trips/page.tsx:112: (comment, FA-0.12)
src/app/trips/page.tsx:224:      <SiteFooter neutralTagline={pageRegion != null && pageRegion !== 'Nordic'} />
src/app/(public)/blog/page.tsx:9:  description: 'Expert fishing tips, regulation guides, and destination stories for anglers heading to Norway, Sweden, Iceland and Finland. Written by anglers, for anglers.',
src/app/(public)/guides/page.tsx:108:  title: 'Fishing Guides in Norway, Sweden, Iceland & Finland',
src/app/(public)/guides/page.tsx:110:    'Curated local fishing guides across Norway, Sweden, Finland and Iceland. Salmon, trout, pike & sea fishing. Filter by country and language to find your perfect guide.',
src/app/(public)/guides/page.tsx:138:    name: 'Fishing Guides in Norway, Sweden, Iceland & Finland',
src/app/(public)/guides/page.tsx:139:    description: 'Curated local fishing guides across Norway, Sweden, Finland and Iceland. Salmon, trout, pike & sea fishing.',
src/app/(public)/guides/page.tsx:199:                Curated local guides across Norway, Sweden, Finland and Iceland. Only the ones we'd book ourselves.
src/components/ui/contact-expert-button.tsx:10:  `https://wa.me/${WHATSAPP_NUMBER}?text=Hi!%20I%27m%20interested%20in%20a%20guided%20fishing%20trip%20in%20Scandinavia.%20Can%20you%20help%20me%20plan%20it%3F`
src/components/home/home-faq.tsx:20: "Nordic rivers are divided into beats..."
src/components/home/home-faq.tsx:28: "Yes. Nordic nature is extraordinary on its own..."
src/components/home/home-faq.tsx:32: "Weather is part of fishing in Scandinavia..."
src/components/home/home-faq.tsx:43: "You're based in Poland. Why should I trust a Polish company for Nordic fishing?"
src/components/layout/footer.tsx:28:                : 'Connecting anglers with the best fishing trips in Scandinavia.'}
src/components/dashboard/profile-edit-form.tsx:329: { title: 'Library images', text: 'Curated high-quality Scandinavian landscapes...' },
src/lib/countries.ts:30,34-38,50: (COUNTRY_REGION map + comment, FA-0.12 — 7 hits)
src/lib/fx.ts:13:  // Non-EUR Nordics
src/lib/ai/inquiry-agent.ts:40: (correct reference prompt — see bucket C)
src/lib/supabase/queries.ts:372: (comment, FA-0.12)
src/lib/blog-data.ts:44,52,53,62: (blog article metadata — see bucket C)
src/lib/ai/extract-trip.ts:79: (SYSTEM_PROMPT — bucket B, fixed below)
```

**Liczba: 58, nie 51.** Różnica +7 pochodzi wyłącznie z kodu, którego 5 IX jeszcze nie było —
FA-0.12 (zmergowane po audycie) dodało `COUNTRY_REGION`/`getRegionGroup()` w `countries.ts`
(7 trafień: enum `'Nordic'` ×6 + 1 komentarz) i komentarze/użycia `neutralTagline` w czterech
plikach (`experiences/[slug]/page.tsx` ×2, `(public)/layout.tsx` ×2, `trips/page.tsx` ×2,
`queries.ts` ×1 — razem 7... nie zgadza się dokładnie 1:1 z +7 w drugą stronę, bo FA-0.12
jednocześnie **usunęło** kilka miejsc z oryginalnych 51 (np. stary hardkodowany tekst stopki
sprzed warunku, stary tytuł `/trips`). Nie próbowałem dopasować różnicy linia-po-linii do
zniknięcia — nie zmienia to klasyfikacji poniżej, tylko całkowitą liczbę wierszy w grepie.

**Klasyfikacja — 5 koszyków:**

#### A — TRZEBA ZMIENIĆ (30 pozycji, widoczne dla klienta z reklamy Patagonii/NZ, chyba że zaznaczone inaczej)

| Plik:linia | Tekst (dosłownie) | Gdzie widać | Widoczne z reklamy Patagonii? |
|---|---|---|---|
| `layout.tsx:28` | `default: 'FjordAnglers — Guided Fishing Trips in Nordic Countries'` | Tytuł karty w Google / tab tytuł na każdej stronie bez własnego `title` (np. `/login`, `/register`, `/legal/*`, `/forgot-password`) | Tak, jeśli klient trafi na jedną z tych stron |
| `layout.tsx:32` | `'Book guided fishing trips in Norway, Sweden, Iceland & Finland...'` | Meta description fallback (jw.) | Tak, jw. |
| `layout.tsx:35` | `'fishing guide Scandinavia', 'sea trout fishing Sweden', 'Nordic fishing guide'` | `<meta name="keywords">` fallback (nadpisane tylko na `experiences/[slug]` i `/trips` przez FA-0.12) | Nie bezpośrednio (meta tag, nie renderowany tekst); crawler-facing |
| `layout.tsx:44` | `title: 'FjordAnglers — Guided Fishing Trips in Nordic Countries'` | OG-preview przy udostępnieniu linku (fallback) | Tak, przy share linku bez własnego OG |
| `layout.tsx:45` | `description: 'Book guided fishing trips in Norway, Sweden, Iceland & Finland...'` | OG-preview description (fallback) | Tak, jw. |
| `layout.tsx:46` | `alt: 'FjordAnglers — Guided Fishing Trips in Nordic Countries'` | OG-image alt (fallback) | Nie bezpośrednio (alt tekst obrazka) |
| `layout.tsx:50` | `title: 'FjordAnglers — Guided Fishing Trips in Nordic Countries'` | Twitter-card title (fallback) | Tak, przy share |
| `layout.tsx:51` | `description: 'Book guided fishing trips in Norway, Sweden, Iceland & Finland...'` | Twitter-card description (fallback) | Tak, jw. |
| `layout.tsx:119` | `description: 'Guided fishing trips marketplace connecting... across Norway, Sweden, Iceland and Finland.'` | JSON-LD `Organization`/`LocalBusiness`, w `<head>` **każdej strony** (nie tylko fallback) | Nie renderowane wprost, ale crawler/AI-citation-facing na KAŻDEJ stronie w tym Bariloche |
| `layout.tsx:141` | `knowsAbout: [..., 'Nordic fishing guides', ...]` | JSON-LD, jw. | Jw. — każda strona |
| `page.tsx:89` | `alt="Angler fishing on a Nordic fjord river at midnight sun"` | Alt tekst hero home page | Tak, jeśli trafi na `/` |
| `page.tsx:114` | `Guided fishing in the Nordic countries` | Eyebrow nad H1, strona główna | Tak |
| `page.tsx:129` | `Guided fishing trips across Norway, Sweden, Iceland and Finland...` | Podtytuł hero, strona główna | Tak |
| `page.tsx:149` | `title: 'Curated Nordic Guides'` | Tytuł karty, strona główna | Tak |
| `page.tsx:155` | `desc: 'Norway, Sweden, Iceland and Finland. The best salmon...'` | Opis karty, strona główna | Tak |
| `page.tsx:220` | `...We've been backpacking Norway, Sweden, and Iceland with rods...` (**nowe, nie było na liście tj**) | Akapit "how it started" na stronie głównej | Tak |
| `page.tsx:302` | `Norway, Sweden, Iceland and Finland — same process everywhere.` | Sekcja "jak to działa", strona główna | Tak |
| `guide-intake/[token]/page.tsx:89` | `FjordAnglers · Connecting guides & anglers across Scandinavia` | Stopka formularza onboardingu przewodnika | **Nie** (przewodnik, nie klient z reklamy) — ale przewodnik z Patagonii widzi to samo |
| `trips/page.tsx:94` | `DEFAULT_DESCRIPTION = 'Browse 20+... across Norway, Sweden, Iceland and Finland...'` | Meta description `/trips` bez filtra kraju | Tak, jeśli reklama linkuje do gołego `/trips` |
| `guides/page.tsx:108` | `title: 'Fishing Guides in Norway, Sweden, Iceland & Finland'` | Tytuł karty w Google, `/guides` | Tak |
| `guides/page.tsx:110` | `'Curated local fishing guides across Norway, Sweden, Finland and Iceland...'` | Meta description `/guides` | Tak |
| `guides/page.tsx:138` | `name: 'Fishing Guides in Norway, Sweden, Iceland & Finland'` | JSON-LD, `/guides` | Crawler-facing |
| `guides/page.tsx:139` | `description: 'Curated local fishing guides across Norway, Sweden, Finland and Iceland...'` | JSON-LD, jw. | Crawler-facing |
| `guides/page.tsx:199` | `Curated local guides across Norway, Sweden, Finland and Iceland. Only the ones we'd book ourselves.` | Widoczny nagłówek na `/guides` | Tak |
| `blog/page.tsx:9` | `'...destination stories for anglers heading to Norway, Sweden, Iceland and Finland...'` | Meta description `/blog` | Tak, jeśli trafi na `/blog` |
| `contact-expert-button.tsx:10` | `...I'm interested in a guided fishing trip in Scandinavia. Can you help me plan it?` | Prefill wiadomości WhatsApp — przycisk "Talk to an Expert", używany m.in. na stronie głównej | **Tak, bardzo widoczne** — klient z Patagonii wysyła literalnie "Scandinavia" pytając o Bariloche |
| `home-faq.tsx:20` | `Nordic rivers are divided into beats...` | FAQ, strona główna | Tak |
| `home-faq.tsx:28` | `Yes. Nordic nature is extraordinary on its own...` | FAQ, strona główna | Tak |
| `home-faq.tsx:32` | `Weather is part of fishing in Scandinavia...` | FAQ, strona główna | Tak |
| `home-faq.tsx:43` | `q: "...why should I trust a Polish company for Nordic fishing?"` | FAQ, strona główna | Tak |

#### B — BŁĄD FUNKCJONALNY (1 pozycja, naprawione od razu)

| Plik:linia | Było | Jest teraz |
|---|---|---|
| `src/lib/ai/extract-trip.ts:79` | `...fishing guides in Norway, Sweden, Iceland, Finland, and New Zealand.` (bez Patagonii) | `...fishing guides in Iceland, Norway, Sweden, Finland, New Zealand, and Patagonia (Argentina & Chile).` — identyczne z `inquiry-agent.ts:40` |

Sprawdzone: `grep -rln "Norway\|Iceland\|Patagonia" src/lib/ai/ src/actions/` → tylko te dwa
pliki promptów + `src/actions/stripe-connect.ts` (tabela kodów walut dla Stripe Connect,
funkcjonalność nieużywana wg ADR-0001 — nie lista krajów obsługi, nie trzeci prompt).
`pnpm typecheck && pnpm test -- --run` → zielone po zmianie.

#### C — ZOSTAJE ŚWIADOMIE (8 pozycji)

| Plik:linia | Uzasadnienie (jedno zdanie) |
|---|---|
| `about/page.tsx:9` | Prawda o założycielach — faktycznie jeździli do Norwegii/Szwecji/Islandii; to biografia, nie obietnica zasięgu firmy. |
| `about/page.tsx:105` | Jw. — historia założycieli. |
| `footer.tsx:28` | To domyślna gałąź warunku z FA-0.12 (`neutralTagline=false`) — prawdziwa dla stron bez kontekstu non-Nordic; mechanizm już istnieje, string sam w sobie poprawny w swoim kontekście. |
| `inquiry-agent.ts:40` | To jest POPRAWNY, wzorcowy prompt (zna Patagonię) — wzorzec dla naprawy w koszyku B, nie problem. |
| `blog-data.ts:44` | Artykuł o poradach od "Scandinavian guides" — temat artykułu faktycznie dotyczy Skandynawii. |
| `blog-data.ts:52` | Tytuł artykułu "Fishing Licenses in Scandinavia" — poprawny, bo taki jest temat. |
| `blog-data.ts:53` | Opis tego samego artykułu o licencjach w Norwegii/Szwecji/Finlandii — jw. |
| `blog-data.ts:62` | Artykuł o lipieniu arktycznym w Skandynawii — temat artykułu, nie obietnica zasięgu. |

#### D — POZA ZAKRESEM (4 pozycje)

| Plik:linia | Dlaczego poza zakresem |
|---|---|
| `offers/[token]/page.tsx:541` | Moduł `/offers` — jawnie wykluczony w "Poza zakresem". |
| `admin/inquiries/[id]/LocationPicker.tsx:210` | Panel admina, komentarz w kodzie (`// centre of Scandinavia`) — nie copy klienckie. |
| `dashboard/profile-edit-form.tsx:329` | Guide dashboard — jawnie wykluczony; opis biblioteki zdjęć, nie obietnica zasięgu. |
| `fx.ts:13` | Komentarz w kodzie (`// Non-EUR Nordics`), nie renderowany nigdzie. |

#### E — JUŻ NAPRAWIONE PRZEZ FA-0.12 (15 pozycji, nie liczone jako otwarte)

`experiences/[slug]/page.tsx:75-76` (komentarz), `:1612` (`neutralTagline` prop) · `(public)/layout.tsx:10-11`
(komentarz) · `trips/page.tsx:94` — **UWAGA**: `trips/page.tsx:94` jest w koszyku A (to
`DEFAULT_DESCRIPTION`, wciąż mówi o Norwegii/Szwecji/Islandii/Finlandii — FA-0.12 naprawiło
tylko *tytuł* domyślny, nie opis) — nie mylić z `:112`/`:224` (komentarz + użycie
`neutralTagline`, te są koszyk E · `countries.ts:30,34-38,50` (`COUNTRY_REGION` + komentarz,
7 miejsc) · `queries.ts:372` (komentarz).

### Not done

- Faza 2 (podmiana tekstu) — czeka na Twoją decyzję, patrz niżej.

### Noticed, not touched
- (żadne nowe — wszystko powyżej sklasyfikowane do A–E)

### Needs a decision

**Bramka STOP — koniec Fazy 1.** Dla każdej z 30 pozycji koszyka A potrzebuję brzmienia albo
decyzji "zostaje bez zmian". Żeby to nie było 30 osobnych pytań — grupuję je po miejscu
renderowania; podaj brzmienie per grupa albo per pozycję, jak wygodniej:

1. **`layout.tsx` default metadata** (title/description/OG/Twitter/keywords, 8 pozycji) — jaki
   ma być domyślny tytuł/opis strony, gdy konkretna podstrona go nie nadpisuje?
2. **`layout.tsx` JSON-LD Organization** (`description`, `knowsAbout`, 2 pozycje) — to samo
   pytanie dla danych strukturalnych, widocznych crawlerom na każdej stronie.
3. **Strona główna** (`page.tsx`, 7 pozycji: hero alt, eyebrow, podtytuł, karta, opis karty,
   akapit "how it started", sekcja procesu) — najbardziej widoczny blok, prawdopodobnie
   największa decyzja marketingowa w tym zadaniu.
4. **`/guides`** (5 pozycji: title, description, JSON-LD ×2, nagłówek) i **`/blog`** (1 pozycja)
   — te same pytanie dla dwóch pozostałych publicznych list.
5. **`home-faq.tsx`** (4 odpowiedzi) — czy odpowiadamy neutralnie, czy dodajemy
   Patagonię/NZ obok Nordyku w treści odpowiedzi?
6. **`contact-expert-button.tsx` WhatsApp prefill** — to pojedyncze zdanie, ale wysyłane
   dosłownie do zespołu sprzedaży; rekomendowałbym priorytet, bo koszt naprawy jest najniższy
   (jedno zdanie) a szkoda najbardziej namacalna (klient sam pisze złą nazwę regionu).
7. **`guide-intake/[token]/page.tsx:89`** — stopka formularza dla PRZEWODNIKÓW, nie klientów;
   potwierdź, czy traktować tak samo jak resztę koszyka A, czy to osobna decyzja (przewodzi z
   Patagonii/NZ też to widzą podczas onboardingu).

Nie proponuję brzmienia — czekam.

### Verification

```
$ grep -rn "Scandinavia\|Scandinavian\|Nordic\|Norway, Sweden\|Norway and Sweden" src \
    --include=*.tsx --include=*.ts | grep -v "src/emails/" | wc -l
58

$ grep -rln "Norway\|Iceland\|Patagonia" src/lib/ai/ src/actions/
src/lib/ai/extract-trip.ts
src/lib/ai/inquiry-agent.ts
src/actions/stripe-connect.ts

$ pnpm typecheck
tsc --noEmit → exit 0

$ pnpm test -- --run
Test Files 4 passed (4) · Tests 21 passed (21)
```
