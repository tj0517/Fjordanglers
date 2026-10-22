---
id: FA-1.63
title: Fakty w hero i „At a glance” wpisywane w adminie (`hero_facts` jsonb) + techniki muchowe
stage: 1
status: review
difficulty: M
model: opus
model_approved:
effort: high
agent: fa-core
branch: feat/v2-hero-facts
pr: 150
depends_on: []
blocked_by_questions: []
touches_db: true
touches_prod: false
estimate_h: 7
owner: tj
---

# FA-1.63 — Fakty w hero i „At a glance” z admina

## Kontekst — przeczytaj przed startem
- `CLAUDE.md` — reguły nienegocjowalne
- `docs/03-conventions.md` — konwencje kodu i migracji
- `docs/02-data-model.md` + `supabase/migrations/20261007000000_experience_offer_centric_expand.sql` — jak dokładano kolumny jsonb do `experience_pages`
- `docs/05-agent-operations.md` §3 — kolejność migracja → kod, bramki STOP
- `src/components/experience-v2/offer-chips.tsx` — chipy S1 wyliczane z `region`, `min/max_days`, `max_anglers_per_guide`, `season_months`, `includes`
- `src/components/experience-v2/offer-at-a-glance.tsx` — S3: techniki, start/pick-up, group size, języki, teren
- `src/lib/supabase/queries.ts` `getExperienceV2` / `ExperienceV2` — jedyne źródło danych strony
- `src/lib/experience-v2-content.ts` — parsery jsonb (wzorzec: `parseLicenseInfo`)
- `src/lib/experiences/v2-editor.ts` — zod formularza v2; `src/components/admin/experience-v2-editor/*` — sekcje zakładki v2
- `src/components/admin/ExperiencePageForm.tsx` — stała `TECHNIQUES` (9 ogólnych), `chipOptions`

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Chipy w hero i karty „At a glance” da się wpisać z ręki w adminie zamiast polegać na
wyliczeniach: lokalizacja, długość dnia (full day / half day / multi-day), liczba osób,
sezon, gear included, start i pick-up, group size jako tekst. Puste pole = dzisiejsze
wyliczenie, więc istniejące strony nie zmieniają wyglądu (O-39 a: jedna kolumna
`hero_facts jsonb`). Lista technik dostaje techniki muchowe, żeby strona NZ/Chile mogła
pokazać „Dry fly, Nymphing, Wade fishing” zamiast samego „Fly fishing”.

## Zakres
- [ ] Odczyt bieżącego stanu: `\d experience_pages` na lokalnym stacku; wypisz w notatkach, skąd każdy chip i każda karta S3 bierze dziś wartość
- [ ] Migracja: `ALTER TABLE experience_pages ADD COLUMN hero_facts jsonb` (nullable, bez defaultu) + wpis w `docs/02-data-model.md`
- [ ] Kształt (zod + parser, jak `license_info`): `{location?: string, day_length?: 'full_day'|'half_day'|'multi_day', group_size?: string, season?: string, gear_included?: boolean, start_pickup?: string}`; puste stringi = brak
- [ ] `getExperienceV2` zwraca `heroFacts`; `OfferChips` i `OfferAtAGlance` biorą wartość z `heroFacts`, a gdy jej nie ma — dotychczasowe wyliczenie (chip po chipie, nie wszystko albo nic)
- [ ] Admin, zakładka v2: sekcja „Hero facts” — 4 pola tekstowe, select długości dnia, przełącznik gear included; `start_pickup` jako textarea (więcej miejsca niż `meeting_point_name`)
- [ ] `TECHNIQUES` += `'Dry fly', 'Wet fly', 'Wade fishing', 'Boat fishing', 'Nymphing', 'Streamer', 'Topwater', 'Saltwater fly fishing'` (ogólne „Fly fishing” zostaje); S3 karta „Techniques” mieści 4+ pozycje bez ucinania

## Gotowe, gdy
- [ ] `supabase db reset` lokalnie zielony; migracja tylko dodaje kolumnę (`git diff` pliku migracji = 1 ALTER + komentarz)
- [ ] Testy: parser `hero_facts` (pełny, częściowy, pusty, śmieci → null), chipy z nadpisaniem i bez (po jednym chipie), S3 z `start_pickup` i `group_size` tekstowym; `pnpm test run hero-facts offer-chips offer-at-a-glance` zielone
- [ ] Strona pilotażowa na lokalnym stacku bez `hero_facts` renderuje identyczne chipy co na `main` (zrzut przed/po w `docs/screenshots/FA-1.63/`)
- [ ] Po wpisaniu w adminie: „Tierra del Fuego”, multi-day, „2–4 anglers”, „Nov–Apr”, gear included — hero pokazuje dokładnie te 5 chipów (zrzut); zod odrzuca `day_length: 'week'` (pokazany na czerwono)
- [ ] Na stronie z technikami `['Fly fishing','Dry fly','Nymphing','Wade fishing']` S3 pokazuje wszystkie cztery (zrzut)
- [ ] `git diff main...HEAD -- src/app/experiences/[slug]/_v1` pusty

## Poza zakresem
- Usunięcie wyliczania chipów (zostaje jako fallback)
- Tłumaczenie faktów / i18n
- Techniki per opcja oferty (`options`) — tylko strona
- Osobne kolumny zamiast jsonb (O-39 b — odrzucone)
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Przed zastosowaniem migracji poza lokalnym stackiem: pełny SQL + wynik `db reset` → akceptacja tj
- `supabase db push` na prod wyłącznie tj (agent-guard blokuje bez `FA_ALLOW_PROD=1`); merge dopiero po zastosowaniu migracji
- Żadnego SQL innego niż SELECT na prod przez MCP
- Edycja istniejących plików migracji — zakazana

## Weryfikacja
```
supabase db reset
pnpm test run hero-facts offer-chips offer-at-a-glance
ls docs/screenshots/FA-1.63/
git diff main...HEAD --stat -- "src/app/experiences/[slug]/_v1"
pnpm typecheck && pnpm lint && pnpm test run && pnpm knip && pnpm build
```

## Notatki z realizacji
- 2026-10-20 tj: O-39 → (a) jedna kolumna `hero_facts jsonb`; nowe techniki dopisane do wspólnej listy `TECHNIQUES` (v1 też ją widzi).
- 2026-10-20 tj: gear included → (b) trzy stany — Automatic (z Includes) / Included / Not included. Automatic = brak wartości w jsonb; `gear_included` zostaje booleanem w kształcie.
- 2026-10-20 tj: lokalna baza → (a) `supabase db reset` teraz; żadna inna sesja nie używa stacku.
- 2026-10-20 tj: miejsce w adminie — NIE karta Content. Osobna sekcja „Hero facts” w zakładce v2: własna karta z własnym zapisem, jak pozostałe sekcje; te same klocki sekcji/pól i ten sam wzorzec zapisu, bez dokładania pól do „Save content”.
- 2026-10-20 tj: domyślne przyjęte — tekst pokazany dokładnie jak wpisany (bez prefiksu „season ”), długość dnia małymi literami („full day” / „half day” / „multi-day”), jedno `group_size` zasila chip i kartę, „Start and pick-up” zastępuje kartę meeting point.
- 2026-10-20 tj: STOP 1 zaakceptowany — migracja `20261011000000_experience_hero_facts.sql` jak pokazana, `comment on column` zostaje. Baza diffów: `origin/main` (lokalny `main` jest za `origin/main`). Weryfikacja: `pnpm test run hero-facts offer-chips offer-at-a-glance` zamiast `pnpm test run -- … v2-editor` — `--` sprawia, że vitest ignoruje filtry, a żaden plik nie pasuje do `v2-editor` (testy schematu są w `hero-facts.test.ts`).
- 2026-10-22 tj: STOP 2 — migracja `20261011000000_experience_hero_facts.sql` trafi na prod przez workflow GitHub Actions (FA-1.20), nie ręcznie. PR #150 zostaje w `review`, dopóki FA-1.20 nie jest zmergowane i prod push się nie wykonał; bez merge do tego czasu.
