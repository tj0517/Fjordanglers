---
id: FA-0.13
title: `estimateLeadValue(location)` — wartość konwersji per destynacja
stage: 0
status: todo
difficulty: S
model: sonnet
model_approved:
effort: low
agent: fa-core
branch: fix/lead-value-location
depends_on: []
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 2
owner: tj
---

# FA-0.13 — `estimateLeadValue(location)`

**Skąd to zadanie (audyt lejka 5 IX 2026).** Zapytanie z Patagonii dostaje dziś wartość konwersji
liczoną stawkami islandzkimi (1 dzień = 100 zł bazowo), a float 2–3 dni w Bariloche to $1 100–2 000
dla dwóch osób. Parametr `location` w `LeadValueParams` istnieje i jest ignorowany. Dopóki
licytacja jest ręczna, nie boli; w momencie przejścia na wartość konwersji Patagonia będzie
systematycznie niedolicytowana. Z lejka: zapytanie wielodniowe jest warte ~12× więcej niż jednodniowe.

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`; `docs/03-conventions.md`
- `src/lib/leadValue.ts` — `BASE_VALUES` (100/400/900/1600), `location?` nieużywany
- `src/lib/leadValue.test.ts` — obecne testy (wartości bazowe × min(osoby,4)/2)
- `src/components/inquiry/InquiryWidget.tsx:309` — jedyne wywołanie; sprawdź, czy widget ma dostęp
  do `country` strony (props / kontekst) — jeśli nie, przekaż z `app/experiences/[slug]/page.tsx`
- `docs/audit/` i artefakt „Lejek FjordAnglers" (5 IX) — skąd stawki
- `claude/patagonia-test-campaign-2026-09.md` (projekt Cowork) — stawki Patagonii: 1 dzień 150, 2–3 dni 600, 4–7 1 200, 7+ 2 000 zł

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Wartość konwersji wysyłana do Google Ads odzwierciedla realny bilet destynacji. Jedna tabela
stawek per grupa (Nordic / Patagonia / New Zealand), domyślna = obecna (Nordic), tak żeby
żadne istniejące wywołanie nie zmieniło wyniku bez `location`.

## Zakres
- [ ] **Odczyt bieżącego stanu**: otwórz `leadValue.ts`, test i wywołanie w widgecie; ustal, skąd widget
      może wziąć `country` (wklej fragment do raportu).
- [ ] `BASE_VALUES` → `Record<LocationGroup, Record<TripLength, number>>` z grupami `nordic` (obecne
      wartości), `patagonia` (150/600/1200/2000), `new_zealand` (do ustalenia — patrz STOP; do czasu
      decyzji = nordic). Mapa kraj → grupa w jednym miejscu (współdzielona z FA-0.12, jeśli tamto
      zadanie ją już założyło — nie dubluj).
- [ ] `estimateLeadValue({ tripLength, groupSize, location })` — `location` to kraj strony; brak → `nordic`.
- [ ] Widget przekazuje `country` strony.
- [ ] Testy: istniejące bez zmian wyniku; nowe dla `Argentina`, `Chile`, nieznanego kraju (→ nordic).

## Gotowe, gdy
- [ ] `pnpm test -- --run src/lib/leadValue.test.ts` zielone, w tym: `{tripLength:'2-3', groupSize:2, location:'Argentina'}` → `600`;
      `{tripLength:'1', groupSize:2}` (bez location) → `100` jak dziś.
- [ ] **Czerwony dowód**: test z `location: 'Atlantis'` oczekuje wartości nordic, nie `NaN`/`undefined`.
- [ ] Lokalnie: submit widgetu na stronie z `country='Chile'` wysyła do `gtag('event','conversion', {value: 600, …})`
      dla `2-3` i 2 osób — zrzut z Network albo `console` w raporcie.
- [ ] `pnpm typecheck && pnpm test -- --run && pnpm build` zielone; `pnpm lint` zero nowych błędów vs `main`.
- [ ] Status `todo → review` tu i w `INDEX.md`, w tym samym PR.

## Poza zakresem
- Zmiana strategii licytacji w Google Ads — decyzja tj poza kodem.
- Import konwersji offline („Deposit paid") — etap 5.
- Cokolwiek w widgecie poza przekazaniem `country`.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Stawki NZ nie są ustalone — **nie wymyślaj**; do decyzji tj zostaw = nordic i wpisz to jawnie w raporcie.

## Weryfikacja
```
pnpm test -- --run src/lib/leadValue.test.ts
grep -n "estimateLeadValue(" -r src   # oczekiwane: widget przekazuje location
pnpm typecheck && pnpm lint && pnpm test -- --run && pnpm build
```

## Notatki z realizacji
