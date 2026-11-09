---
id: FA-1.82
title: Huby Norwegii, Szwecji i Finlandii w kodzie + jakość hubów (`FAQPage`, `BreadcrumbList`, linki do przewodników i artykułów)
stage: 1
status: review
difficulty: M
model: sonnet
model_approved:
effort: high
agent: fa-web
branch: feat/fa-1.82-nordic-hubs
pr: 180
depends_on: []
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 6
owner: tj
---

# FA-1.82 — Huby Norwegii, Szwecji i Finlandii

## Kontekst — przeczytaj przed startem
- `CLAUDE.md` — reguły nienegocjowalne
- `docs/03-conventions.md` — konwencje
- `docs/audit/seo-audit-2026-11.md` — F13, F14, F15, §2.9
- `docs/tasks/FA-1.65.md`, `docs/tasks/FA-1.66.md` — szablon hubu i decyzje O-42–O-45
- `src/lib/destinations.ts` — konfiguracja hubów (dziś 3, pola redakcyjne puste)
- `src/app/(public)/[destination]/page.tsx`, `src/lib/supabase/queries.ts` (`getDestinationHub`, ~l. 1130)
- `src/components/layout/footer.tsx` (l. 71–74) — linki krajów

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Popyt na Norwegię i Szwecję trafia dziś na `/trips` i strony pojedynczych ofert na pozycjach 20–40 (GSC: „norway fishing trips” 177 wyświetleń, poz. 21,5; „guided fishing norway” 73, poz. 15,9), bo te kraje nie mają własnej strony. Po zadaniu działają `/norway`, `/sweden`, `/finland` z treścią redakcyjną, a każdy hub (także trzy istniejące) emituje FAQ i okruszki w danych strukturalnych i linkuje do przewodników i artykułów swojego kraju. Treść tymczasowo w kodzie; przeniesienie do bazy → FA-1.85 (decyzja tj D2, 2026-11-03).

## Zakres
- [ ] Odczyt stanu: `DESTINATION_HUBS` (slugi, `countries`), liczba aktywnych ofert per kraj (SELECT, wynik wklejony).
- [ ] Trzy wpisy hubów: `norway`, `sweden`, `finland` (`group: 'Nordic'`, `countries` jednoelementowe); Islandia bez zmian.
- [ ] Pola redakcyjne (intro, sezon, szczyt, gatunki, FAQ, meta) dla 6 hubów. Teksty szkicuje agent ze źródeł (prod: bio przewodników i treść ofert; repo: artykuły; audyt SEO), każde twierdzenie ze źródłem; STOP przed testami i PR — tj zatwierdza teksty.
- [ ] `FAQPage` (gdy FAQ niepuste) i `BreadcrumbList` w JSON-LD hubu.
- [ ] Sekcja przewodników kraju z linkami do profili; miejsce na linki do artykułów (puste do FA-1.83).
- [ ] Stopka: linki krajów na huby zamiast `/trips?country=`.

## Gotowe, gdy
- [ ] Lokalnie `/norway`, `/sweden`, `/finland` → 200, H1 i meta z konfiguracji — `curl` wklejony.
- [ ] Na każdym z 6 hubów JSON-LD: `ItemList`, `BreadcrumbList`, `FAQPage` (gdy FAQ) — `grep '"@type"'` wklejony.
- [ ] Hub linkuje do ≥ 1 profilu przewodnika swojego kraju — liczba linków `/guides/` per hub wklejona.
- [ ] Sitemapa zawiera 6 hubów; stopka bez `/trips?country=` — grep wklejony.
- [ ] Test konfiguracji hubów (każdy hub ma niepuste intro, meta, FAQ) zielony; red proof na hubie bez FAQ — wklejone.
- [ ] CI zielone — lista wklejona.

## Poza zakresem
- Tabela hubów i edytor → FA-1.85.
- Strony regionów i rzek (D5: później).
- Artykuły → FA-1.83/1.84; linki z artykułów → FA-1.90.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Teksty szkicuje agent ze źródeł (prod: bio przewodników i treść ofert; repo: artykuły; audyt SEO), każde twierdzenie ze źródłem; STOP przed testami i PR — tj zatwierdza teksty.

## Weryfikacja
```
for h in norway sweden finland iceland patagonia new-zealand; do curl -s -o /dev/null -w "$h %{http_code}\n" localhost:3000/$h; done
curl -s localhost:3000/norway | grep -o '"@type":"[A-Za-z]*"' | sort | uniq -c
grep -n "trips?country" src/components/layout/footer.tsx
```

## Notatki z realizacji
- **2026-11-03, tj:** D2 — najpierw huby w kodzie przed 15.11, tabela i edytor później (FA-1.85, razem z edytorem bloga). Teksty pisze Krzysztof w Notionie, do kodu wkleja agent. O-42 wraca na (b) w FA-1.85.
- **2026-11-09, tj:** w Notionie brak tekstów hubów — opcja C: szkice pisze agent ze źródeł, tj zatwierdza przed merge'em (termin 15.11).
- **2026-11-09, tj — teksty zatwierdzone z 5 poprawkami:** (1) Norwegia FAQ 1: Toni Corenius — „May–June and September–October” (sprzeczność `season_start/end` vs `season_months` → deferred); (2) Patagonia: daty 16 X–14 IV przypisane do Natales Fly Fishing jako sezon Magallanes, bez sezonu „Chile” ogółem; (3) NZ FAQ 1: cytat z FAQ oferty North Island, Fish & Game tylko przy Southland; (4) Islandia seasonNote: „May to July are the months guides most often name as best”; (5) Szwecja: „Kalix Jakt & Fisketurism (KJOFT)” przy pierwszej wzmiance, potem „KJOFT”.
- **2026-11-09, tj — decyzje:** D1 pełny 12-miesięczny pasek sezonu na NO/SE/FI, bez miesięcy szczytu, z seasonNote (sezony różnią się per przewodnik, odsyła do FAQ); D2 hub Norwegii linkuje `/blog/fishing-regulations-norway-2026` od razu; D3 aktualizacja przestarzałych intro Patagonii i Nowej Zelandii wg stanu prod. STOP ponownie: nowe seasonNotes, dwa intro i poprawki 1–5 do zatwierdzenia przed testami i PR.
- **2026-11-09, tj — zatwierdzone (ostateczne):** (1) intro Patagonii bez zdania „Another guide covers Punta Arenas and Tierra del Fuego.” (ukryty profil; Javier Leppe pokrywa Ziemię Ognistą); (2) metaDescription Szwecji: „Guided fishing in Sweden: Stockholm and Lake Mälaren, Alingsås near Gothenburg, Blekinge, and Kalix in Lapland. Pike, zander, perch, sea trout, salmon.” Reszta jak pokazano (seasonNotes, intro NZ, meta Patagonii/NZ, poprawki 1–5 z zdaniem o Aysén, peakMonths Patagonii lis–mar, KJOFT). Deferred dodatkowo: Southland `season_end` maj vs FAQ „October to April”.
