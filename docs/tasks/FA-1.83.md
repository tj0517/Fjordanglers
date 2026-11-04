---
id: FA-1.83
title: Blog, krok 1 — tabela wpisów + publiczny czytnik (metadane, schema, sitemapa z tabeli), przeniesienie obecnego artykułu, koniec stubów
stage: 1
status: todo
difficulty: L
model: opus
model_approved:
effort: high
agent: fa-core
branch: feat/fa-1.83-blog-table
pr:
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
