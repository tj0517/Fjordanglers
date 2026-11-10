---
id: FA-1.83
title: Blog, krok 1 — tabela wpisów + publiczny czytnik (metadane, schema, sitemapa z tabeli), przeniesienie obecnego artykułu, koniec stubów
stage: 1
status: review
difficulty: L
model: opus
model_approved:
effort: high
agent: fa-core
branch: feat/fa-1.83-blog-table (+ feat/fa-1.83-blog-posts-migration, feat/fa-1.83-blog-norway-data)
pr: 183, 185, 186
depends_on: [FA-1.80]
blocked_by_questions: []
touches_db: true
touches_prod: true
estimate_h: 10
owner: tj
---

# FA-1.83 — Blog, krok 1: tabela + czytnik

## Kontekst — przeczytaj przed startem
- `CLAUDE.md` — reguły nienegocjowalne (reguła 3: `.from(` tylko w warstwie danych)
- `docs/03-conventions.md` — konwencje kodu i migracji
- `docs/02-data-model.md` + `docs/audit/rebuild-audit-db-aug-2026.md` — schemat
- `docs/05-agent-operations.md` §3 — kolejność migracja → kod
- `docs/audit/seo-audit-2026-11.md` — §2.8 (opcja A), F9, F10, D4
- `docs/tasks/FA-1.68.md` — wzorzec: tabela + migracja w osobnym PR (decyzja tj 2026-10-24)
- `src/lib/blog-data.ts`, `src/lib/blog-content/`, `src/app/(public)/blog/` — obecny mechanizm (wpis w kodzie + komponent JSX)

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Dziś artykuł to wpis w `blog-data.ts` + komponent JSX (570 linii) + dwie mapy w stronie, a publikacja = PR i deploy. 5 z 6 wpisów to puste stuby z `noindex` w sitemapie. Po zadaniu artykuły żyją w tabeli, publiczna strona artykułu buduje z niej metadane (tytuł ≤ 60, opis ≤ 155, daty ISO, własne zdjęcie OG), `Article` + `BreadcrumbList`, a sitemapa i lista bloga czytają tylko opublikowane wpisy. Obecny artykuł o Norwegii przeniesiony bez zmiany adresu. Edytor w panelu → FA-1.84 (decyzja tj D4, 2026-11-03: opcja A w dwóch krokach).

## Zakres
- [ ] Odczyt stanu: obecne wpisy i ich slugi, `ls supabase/migrations | tail -3`, czy tabela o tej nazwie nie istnieje na prod (SELECT, wynik wklejony).
- [ ] Projekt tabeli (np. `blog_posts`: slug unikalny, tytuł, tytuł SEO, opis, treść w Markdown (O-49 (a)), zdjęcie + alt, kategoria, kraj/hub, przewodnik opcjonalnie, status szkic/opublikowany, `published_at`, `updated_at`) + RLS: anon czyta tylko opublikowane, zapis tylko admin — **STOP z SQL przed migracją**.
- [ ] Odczyt przez warstwę danych (`queries.ts`), strona artykułu i lista bloga z tabeli, ISR z `revalidateTag('blog')`.
- [ ] Renderowanie Markdown z sanityzacją (bez surowego HTML) — test XSS.
- [ ] Przeniesienie artykułu `fishing-regulations-norway-2026` (ten sam slug) jako wiersz; stuby usunięte z kodu i z sitemapy.
- [ ] Sitemapa: wpisy z tabeli, `lastModified` z `updated_at`.

## Gotowe, gdy
- [ ] Migracja na prod (przez `migrate-prod`, tj) i odczyt `information_schema.columns` + `pg_policies` dla tabeli — wklejone.
- [ ] RLS: anon nie widzi szkicu, nie zapisuje (red proof: 42501 / 0 wierszy) — wklejone.
- [ ] `/blog/fishing-regulations-norway-2026` → 200 z tym samym slugiem; meta title ≤ 60, description ≤ 155, `datePublished`/`dateModified` w ISO — `curl` wklejony.
- [ ] Test XSS: `<script>` w treści nie trafia do HTML — red proof wklejony.
- [ ] Sitemapa nie zawiera stubów ani szkiców; 5 dawnych stubów → 404 — wklejone.
- [ ] CI zielone — lista wklejona.

## Poza zakresem
- Edytor w panelu, upload zdjęć → FA-1.84.
- Publikacja zaplanowana na datę (cron) → deferred.
- Treść hubów → FA-1.85; linki z artykułów do ofert → FA-1.90.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- SQL migracji (tabela + RLS) — pokaż i czekaj na akceptację.
- Migracja na prod **wyłącznie** przez `deploy-db.yml` (`migrate-prod`, zatwierdza tj); agent go nie uruchamia. Kolejność jak FA-1.68: osobny PR migracyjny z `origin/main` → merge (tj) → `migrate-prod` (tj) → odczyt tabeli na prod → PR z kodem.
- Wstawienie przeniesionego artykułu na prod (zapis danych) — STOP: pokaż sposób (migracja danych albo panel po FA-1.84) i czekaj.
- Stan bazy ustalasz bieżącym odczytem, nigdy z pamięci, notatek ani pliku typów.

## Weryfikacja
```
curl -s localhost:3000/blog/fishing-regulations-norway-2026 | grep -oE '<title>[^<]*|"datePublished":"[^"]*"'
curl -s localhost:3000/sitemap.xml | grep -c '/blog/'
pnpm test -- blog
```

## Notatki z realizacji
- **2026-11-03, tj:** D4 — system bloga A (tabela + edytor w `/admin`) w dwóch krokach; artykuły z pakietu 15.11 wchodzą po 15.11 z tego systemu (decyzja (c)), Krzysztof pisze w Notionie.
- **2026-11-03, tj:** O-49 (a) — treść artykułu w Markdown (tekst z Notiona wkleja się 1:1).
- **2026-11-10, tj:** D1 (a) — treść w Markdown (O-49 (a)) + mały zestaw nazwanych bloków, żeby artykuł o Norwegii zachował wygląd: ostrzeżenie, info, wyróżniona liczba (stat), zdjęcie z podpisem (składnia dyrektyw, np. `:::warning` … `:::`), mapowane na istniejące komponenty; tabele GFM; spis treści budowany z nagłówków Markdown (zastępuje `NORWAY_SECTIONS`). Zestaw bloków minimalny — tekst wklejony z Notiona działa bez zmian; co nie ma bloku, jest zwykłym Markdownem.
- **2026-11-10, tj:** D2 (B) — trzy PR-y, żeby jedyny zaindeksowany artykuł nigdy nie dał 404: (1) migracja tabeli → merge (tj) → `migrate-prod` (tj) → odczyt prod; (2) PR z kodem, gotowy i sprawdzony lokalnie, NIE zmergowany; (3) migracja danych z wierszem Norwegii z `origin/main` → merge (tj) → `migrate-prod` (tj) → odczyt prod; dopiero potem tj merguje (2).
- **2026-11-10, tj:** D3 (tak) — JSON-LD na stronie artykułu przez `serializeJsonLd` (zamyka wiersz deferred FA-1.81 tylko dla `blog/[slug]/page.tsx`).
- **2026-11-10, tj:** SQL tabeli `blog_posts` zatwierdzony, z decyzjami: C1 — zapis wyłącznie przez service role po `requireAdmin()`, bez polityki zapisu dla admina w bazie, blok REVOKE/GRANT bez zmian; C2 — zostaje CHECK `blog_posts_published_complete` (edytor FA-1.84 musi pokazać czytelny komunikat zamiast surowego błędu bazy — wiersz w deferred); C3 — `category` to wolny tekst, zamknięta lista razem z FA-1.84. Przyjęte też: opis Norwegii skrócony do ≤ 155 znaków (tekst pokazać na STOP przed PR 3), brak kolumny hub, czas czytania liczony z treści, bez publikacji zaplanowanej. C4 — nie zatrzymywać stosu Seaclouds (DCS); przed pierwszym `next dev` / Playwright: `df -h /mnt/c` + `docker ps` wklejone, ≥ 10 GB wolne → oba stosy zostają, mniej → STOP; `pnpm build` tylko przy wszystkich stosach zatrzymanych, najpierw zapytać.
- **2026-11-10, tj:** SEO title `Fishing in Norway 2026: Regulations, Licenses & Limits` (bez sufiksu „ | FjordAnglers" — `<title>` bloga to `seo_title` dokładnie jak w wierszu) i opis 153 znaki — zatwierdzone jak zaproponowano.
- **2026-11-10, tj:** Decyzja 1 → B — węższy pasek „Contents", etykiety przycinane do dwóch linii; nagłówki bez zmian (zrobione w PR 2, zrzut przy 1280 px: `.playwright-mcp/fa-1.83-after-toc-1280.png`). Decyzja 2 → A — zwykły Markdown zamiast etykiet „Part", plakietek tabeli, układu FAQ i kart linków; zestaw bloków zostaje przy czterech z D1.
- **2026-11-10, tj:** wiersz deferred: `/blog` (lista) jest `force-dynamic` (renderowana per żądanie, nie z CDN jak inne publiczne strony po FA-1.80), bo build nie ma bazy; dane nadal przez `unstable_cache`; wrócić przy FA-1.92.
- **2026-11-10:** PR 3 (#186) zmergowany i `migrate-prod` wykonany przez tj; odczyt prod potwierdza wiersz `fishing-regulations-norway-2026` (opublikowany, 2026-03-17) — wklejony w #185. Status `review`; `done` ustawia tj po „accepted — close it".
