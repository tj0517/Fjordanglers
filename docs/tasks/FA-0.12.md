---
id: FA-0.12
title: Strona mówi o swoim regionie — stopka, `/trips` per kraj, cross-sell po kraju, tytuł bez podwójnego sufiksu
stage: 0
status: todo
difficulty: M
model: sonnet
model_approved:
effort: medium
agent: fa-core
branch: fix/region-aware-chrome
depends_on: []
blocked_by_questions: []
touches_db: true
touches_prod: true
estimate_h: 5
owner: tj
---

# FA-0.12 — Strona mówi o swoim regionie

**Skąd to zadanie (audyt lejka 5 IX 2026).** Amerykanin z reklamy Patagonii ląduje na stronie,
której stopka mówi „Connecting anglers with the best fishing trips in **Scandinavia**", lista
destynacji to Norwegia/Szwecja/Finlandia/Islandia/Dania, „More like this" pod Bariloche
proponuje archipelag sztokholmski i Finnmark, a `/trips?country=New Zealand` ma tytuł
„Guided Fishing Trips in Norway, Sweden, Iceland & Finland". Tytuł każdej strony kończy się
„| FjordAnglers | FjordAnglers". Żadna z tych rzeczy nie jest redesignem — to dane i konfiguracja.

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`; `docs/03-conventions.md`
- `src/components/layout/footer.tsx:22` (tagline) i `:66–70` (lista destynacji na sztywno)
- `src/app/trips/page.tsx:91–100` — statyczne `metadata` mimo `searchParams.country` (linia 128)
- `src/app/experiences/[slug]/page.tsx:191–200` — `similarTrips`: fallback bierze **dowolne** 3 aktywne strony
- `src/app/experiences/[slug]/page.tsx:45–70` — `generateMetadata`: `title = meta_title ?? experience_name`
- `src/app/layout.tsx:28–29` — `title.template: '%s | FjordAnglers'` → jeśli `meta_title` w bazie już ma sufiks, jest podwójny
- `docs/tasks/FA-0.11.md` — równoległe zadanie na cenach; nie dubluj `formatPrice`

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Strona doświadczenia, `/trips` z filtrem kraju i stopka mówią o kraju, w którym jest klient,
a nie o Skandynawii. Cross-sell nigdy nie wysyła klienta z Argentyny do Szwecji ani na stronę
partnera, którego nie umiemy wycenić. Tytuł strony ma jeden sufiks.

## Zakres
- [ ] **Odczyt bieżącego stanu** (kod): otwórz pliki z kontekstu; `grep -rn "Scandinavia\|Nordic" src --include=*.tsx`
      (lista do raportu; maile poza zakresem, ale wymień).
- [ ] **Odczyt bieżącego stanu** (dane, produkcja, SELECT):
      ```sql
      select country, count(*) filter (where status='active') as active, count(*) as total
      from experience_pages group by country order by 1;
      select slug, meta_title from experience_pages where meta_title ilike '%fjordanglers%';
      select slug, country, status from experience_pages
      where slug in ('split-destination-lodge-week-aysen','torres-del-paine-magallanes','patagonia-river-guides%') or experience_name ilike '%flywise%' or experience_name ilike '%natales%' or experience_name ilike '%patagonia river guides%';
      ```
      (dokładne slugi Flywise / Natales / PRG ustal z pierwszego zapytania — nie zgaduj).
- [ ] **Stopka**: tagline zależny od kontekstu — na stronach z `country` spoza Nordyku i na `/trips?country=…`
      tekst neutralny („Hand-picked guided fishing trips with local owner-guides."), na reszcie może zostać
      obecny. Lista destynacji budowana z `experience_pages` (kraje z ≥1 stroną `active`), nie z tablicy na sztywno;
      flagi z mapy kraj→emoji w jednym miejscu. Dania bez aktywnych stron znika sama.
- [ ] **`/trips`**: `generateMetadata({ searchParams })` — `country` obecne → „Guided Fishing Trips in {Country}"
      + opis per kraj; brak → obecny tytuł, ale bez wyliczanki krajów w tytule (użyj „Guided Fishing Trips with Local Guides").
- [ ] **Cross-sell**: fallback `similarTrips` po **grupie regionu** (mapa kraj→grupa: Nordic / Patagonia / New Zealand),
      nigdy „dowolne 3"; jeśli w grupie nie ma innych aktywnych stron — sekcja się nie renderuje.
- [ ] **Partnerzy bez potwierdzonej prowizji** (Flywise, PRG, Natales) → `status='draft'` — patrz STOP; to wypina ich
      jednocześnie z cross-sellu, `/trips` i sitemapy bez dodatkowej flagi w kodzie.
- [ ] **Stary tag Ads**: `src/app/layout.tsx` ładuje `AW-18008446689` obok właściwego `AW-18171634204`
      (Tag Assistant 5 IX: 4 tagi na stronie). Usunąć stary; zostaje jedno `gtag('config','AW-18171634204')`.
      Przed usunięciem `grep -rn "18008446689" src` — lista do raportu.
- [ ] **Tytuł**: w `generateMetadata` — jeśli `meta_title` kończy się na `| FjordAnglers`, zwróć `title: { absolute: meta_title }`;
      w przeciwnym razie zostaw template. Nie edytuj danych w tym zadaniu.

## Gotowe, gdy
- [ ] `curl -s https://fjordanglers.com/experiences/fly-fishing-bariloche-limay-manso | grep -c "Scandinavia"` → 0.
- [ ] `curl -s "https://fjordanglers.com/trips?country=New%20Zealand" | grep -o "<title>[^<]*"` → zawiera `New Zealand`, nie `Norway`.
- [ ] `curl -s https://fjordanglers.com/experiences/fly-fishing-coyhaique-aysen | grep -o "<title>[^<]*"` → dokładnie jedno wystąpienie `FjordAnglers`.
- [ ] Sekcja „More like this" pod Bariloche pokazuje wyłącznie strony z grupy Patagonia (Argentyna/Chile) — zrzut listy slugów w raporcie.
- [ ] Stopka na stronie Bariloche zawiera `Argentina` i `Chile` w destynacjach, a nie zawiera `Denmark` (o ile Dania nie ma aktywnej strony — z odczytu).
- [ ] Po STOP-owanym UPDATE: `select slug, status from experience_pages where slug in (<Flywise, PRG, Natales>)` → `draft`; strony zwracają 404 lub redirect, nie treść.
- [ ] `grep -rn "18008446689" src` → 0 trafień; Tag Assistant na produkcji pokazuje 3 tagi (GTM, G-, jeden AW-), nie 4.
- [ ] `pnpm typecheck && pnpm test -- --run && pnpm build` zielone; `pnpm lint` zero nowych błędów vs `main`.
- [ ] Status `todo → review` tu i w `INDEX.md`, w tym samym PR.

## Poza zakresem
- Strona hub `/patagonia` — FA-0.14.
- Poprawa `meta_title` w danych (podwójny sufiks u źródła) — dopisz listę slugów do `docs/deferred-tasks.md`.
- Maile i teksty w `src/emails/`.
- Jakikolwiek redesign layoutu — zmieniamy dane wejściowe komponentów, nie komponenty.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- `UPDATE experience_pages SET status='draft' WHERE slug IN (...)` na produkcji — **STOP**: pokaż SELECT przed,
  dokładny UPDATE, poczekaj na zgodę tj; wykonuje tj. Lista slugów z odczytu, nie z pamięci.
- Jeśli odczyt pokaże, że kraj w `experience_pages.country` jest zapisany niespójnie (`Chile` vs `chile`,
  `New Zealand` vs `NZ`) — **STOP**, nie normalizuj w locie; zgłoś i zaproponuj migrację.

## Weryfikacja
```
grep -rn "Scandinavia\|Nordic" src --include=*.tsx | grep -v src/emails/        # oczekiwane: tylko warunkowy tagline
curl -s "http://localhost:3000/trips?country=Chile" | grep -o "<title>[^<]*"
curl -s http://localhost:3000/experiences/<slug-patagonia> | grep -o "<title>[^<]*" | grep -o FjordAnglers | wc -l   # 1
pnpm typecheck && pnpm lint && pnpm test -- --run && pnpm build
```

## Notatki z realizacji
