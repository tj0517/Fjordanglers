---
id: FA-1.86
title: Przewodnicy — slugi dla 6 bez sluga, slug obowiązkowy przy aktywacji, scalenie duplikatu Josh Hart, ukrycie dwóch pustych profili, koniec linków z UUID, profile bez oferty poza indeksem
stage: 1
status: in_progress
difficulty: M
model: sonnet
model_approved:
effort: high
agent: fa-core
branch: feat/fa-1.86-guide-slugs
pr:
depends_on: []
blocked_by_questions: []
touches_db: true
touches_prod: true
estimate_h: 5
owner: tj
---

# FA-1.86 — Slugi i cienkie profile przewodników

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md`
- `docs/02-data-model.md` — `guides`
- `docs/audit/seo-audit-2026-11.md` — F5, F6, §2.3, D3
- `src/app/(public)/guides/[id]/page.tsx` (l. 66, 105–109) — przekierowanie UUID → slug, canonical
- `src/app/(public)/guides/page.tsx:268`, `src/app/page.tsx:431`, `src/app/sitemap.ts:65` — fallbacki `?? guide.id`
- `src/app/admin/guides/` — formularz przewodnika

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
6 aktywnych, widocznych przewodników nie ma sluga, więc ich UUID trafia do sitemapy, linków, canonicali i JSON-LD; 3 z nich nie mają żadnej oferty, jeden ma pusty kraj, a jeden to duplikat Josha Harta. Po zadaniu każdy aktywny przewodnik ma slug (aplikacja nie pozwoli aktywować bez niego), w kodzie nie ma fallbacku na UUID, duplikat `cd8f48f1…` przekierowuje 308 na profil Josha Harta z ofertą, Emanuel Cosic i Lucky Lure są ukryci do uzupełnienia, a profile bez aktywnej oferty mają `noindex` i nie ma ich w sitemapie (decyzja tj D3, 2026-11-03).

## Zakres
- [ ] Odczyt stanu (SELECT, wklejony): przewodnicy `active`, nie ukryci, bez sluga; liczba aktywnych ofert per przewodnik; oba wiersze Josha Harta.
- [ ] Propozycja slugów dla 6 (wzór istniejących: `imie-nazwisko-kraj`) — STOP, akceptacja tj.
- [ ] Zapis slugów, scalenie duplikatu (przekierowanie `cd8f48f1…` → slug `1a30602e…`), ukrycie Emanuel Cosic i Lucky Lure — sposób (panel czy migracja danych) — STOP.
- [ ] Walidacja: aktywacja przewodnika bez sluga odrzucona (akcja + ewentualnie constraint w bazie — STOP z SQL).
- [ ] Usunięcie `?? guide.id` z listingów, strony głównej, sitemapy; profil bez aktywnej oferty → `robots: noindex` i poza sitemapą.

## Gotowe, gdy
- [ ] SELECT po zmianie: 0 aktywnych, widocznych bez sluga — wklejony.
- [ ] Aktywacja bez sluga odrzucona — red proof wklejony.
- [ ] `grep -rn "?? guide.id\|?? g.id" src` → 0 — wklejony.
- [ ] Po deployu: `/guides/cd8f48f1-0633-4832-9c56-0f2cb4c7ee6d` → 308 na profil z ofertą; sitemapa bez UUID i bez profili bez oferty — `curl` wklejony.
- [ ] CI zielone — lista wklejona.

## Poza zakresem
- Uzupełnianie treści profili (tj z przewodnikami).
- Usuwanie wierszy przewodników — zakaz, tylko ukrycie.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Każdy zapis danych na prod (slugi, `is_hidden`, przekierowanie) — pokaż dokładne zmiany i czekaj; migracja tylko przez `migrate-prod` (tj).
- Constraint w bazie — SQL do akceptacji przed migracją.
- Usunięcie wierszy — zakaz.
- Stan bazy ustalasz bieżącym odczytem, nigdy z pamięci, notatek ani pliku typów.

## Weryfikacja
```
grep -rn "?? guide.id\|?? g.id" src
curl -sI https://www.fjordanglers.com/guides/cd8f48f1-0633-4832-9c56-0f2cb4c7ee6d | grep -iE '^HTTP|^location'
```

## Notatki z realizacji
- **2026-11-03, tj:** D3 — rekomendacje z audytu: scalić Josha Harta, ukryć Emanuel Cosic i Lucky Lure do uzupełnienia; profile bez oferty poza indeksem.
- **2026-11-09, tj:** D1 — UUID fallback usuwamy tylko z powierzchni publicznych (listing, strona główna, sitemapa, JSON-LD, oferta v1, hub, canonical profilu). Admin i panel przewodnika zostają z UUID — przewodnik w statusie pending legalnie nie ma sluga.
- **2026-11-09, tj:** D2 — przekierowanie duplikatu to pojedyncze mapowanie w kodzie strony profilu przewodnika, bez nowej tabeli.
- **2026-11-09, tj:** D3 — jedna migracja w tym PR: najpierw dane (slugi, ukrycie), potem reguła bazy „active ⇒ slug". tj uruchamia ją na prod przez `deploy-db` po merge.
- **2026-11-09, tj:** Kryterium „grep" zmienione względem pliku zadania zgodnie z D1 — zakres: `src/app/(public)`, `src/app/page.tsx`, `src/app/sitemap.ts`, `src/lib/seo`, `src/app/experiences`, `src/components/destination-hub`; trafienia w admin/dashboard wypisane osobno jako zamierzone.
- **2026-11-09, tj:** Slugi zatwierdzone: `dustin-habener-new-zealand`, `josh-hart-new-zealand`, `kristina-placko-daryl-paskell-new-zealand`, `emanuel-cosic`, `lucky-lure-fishing-finland`.
- **2026-11-09, tj:** Decyzja 1 = C — duplikat `cd8f48f1…` dostaje `status='suspended'` + `is_hidden=true`; jeden wiersz `agent_knowledge` (`14fd7003…`) przechodzi na `1a30602e…`; 3 zapytania zachowują `assigned_guide_id` bez zmian. SQL migracji zatwierdzony (z opcją C).
- **2026-11-09, tj:** Decyzja 2 = (i) z blokadą — pole slug w formularzach create/edit, wstępnie z imienia + kraju, format i unikalność sprawdzane w akcji. Gdy przewodnik jest `active`, slug jest tylko do odczytu w formularzu edycji (zmiana wymaga najpierw dezaktywacji; krótka podpowiedź pod polem). Aktywacja bez sluga zwraca czytelny błąd; `QuickApproveButton` pokazuje błąd akcji; `createBetaGuide` wymaga sluga.
- **2026-11-09, tj:** Kolejność po merge: merge → poczekać na deploy produkcyjny Vercel → `deploy-db` na prod → SELECT na prod i trzy `curl`.
