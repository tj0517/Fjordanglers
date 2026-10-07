---
id: FA-1.54
title: Szablon v2 — środek strony (S3–S9): w skrócie, w cenie / poza ceną, dla kogo i dla kogo nie, przebieg dnia, przewodnicy, jak działa rezerwacja, cena i depozyt
stage: 1
status: done
difficulty: M
model: sonnet
model_approved:
effort: medium
agent: fa-core
branch: feat/experience-v2-body
pr: 136
depends_on: [FA-1.53]
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 8
owner: tj
---

# FA-1.54 — v2: sekcje S3–S9

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md`
- `docs/proposals/2026-10-05-experience-offer-centric.md` §2.4–2.6 (pola treści), §7 krok 3
- Wireframe (artboard Desktop sekcje S3–S9, Mobile akordeony) — kolejność i zawartość
- `docs/04-open-questions.md` — O-34 (S7 pokazuje wszystkich przypiętych), O-35 (zwrot depozytu: globalna polityka FA + `weather_policy_text` per oferta), O-36 (SLA/ETA per oferta)
- `src/lib/supabase/queries.ts` — `getExperienceV2` z FA-1.53 (rozszerzasz typ, nie dodajesz drugiego zapytania)
- `src/lib/pricing/experience-price.ts` — tabela cen w S9 liczy tym samym kodem co widget
- `src/app/experiences/[slug]/_v2/`, `src/components/experience-v2/`

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Środek strony ma kwalifikować klienta treścią, zanim trafi do przewodnika: kto to dla kogo jest, co dokładnie dostaje i za co płaci osobno (licencja), jak wygląda dzień, kto go poprowadzi i jak działa depozyt. Każda sekcja czyta pola z FA-1.50; gdy pole jest puste, sekcja się nie renderuje (nie pokazujemy pustych nagłówków).

## Zakres
- [ ] Odczyt bieżącego stanu: typ zwracany przez `getExperienceV2`; lista pól z FA-1.50 w `database.types.ts`; wireframe
- [ ] S3 „W skrócie”: karty gatunki (`species_details`), techniki (`technique`), start/odbiór (`meeting_point_*`), osoby (`max_anglers_per_guide`), języki przewodnika primary, teren (`walking_km_min/max`)
- [ ] S4 „Co w cenie / Co poza ceną”: `includes` / `excludes`; licencja z `license_info` jako osobny wiersz z linkiem i „kupujesz sam online”; napiwek z `tip_guidance_text`; addony (`experience_page_options.kind='addon'`) z ceną
- [ ] S5 „Dla kogo / dla kogo nie”: `suited_for`, `not_suited_for`, `expectations_text` jako cytat; mobile: rozwinięta
- [ ] S6 „Przebieg dnia”: `fixed` → timeline z `day_schedule` (czas, tytuł, meta: dojazd/km/brodzenie); `custom` → karty archetypów (`kind='archetype'`) z `sample_itinerary` i przełącznikiem; zawsze zdanie o planie przykładowym i pogodzie
- [ ] S7 „Twoi przewodnicy”: karta dla **każdego** wiersza `experience_guides` z `show_on_page` (O-34): avatar, imię, `years_experience`, `association`, języki, `response_time_hours`, `bio` skrócone, cytat jeśli jest; obok mini-karta FA (statyczna treść z `docs/brand/` — jeśli nie ma, placeholder `[Kim jesteśmy]` i zgłoś)
- [ ] S8 „Jak działa rezerwacja”: 4 kroki, krok 2 z `offer_eta_text`, krok 3 z `fee_pct` i ważnością oferty (tekst globalny), krok 4 z `guides.default_balance_payment_method` primary
- [ ] S9 „Cena i depozyt”: `fixed` → tabela dni × wędkarze z `experience-price` (total), blok Razem/Depozyt/Saldo dla domyślnej konfiguracji, ostrzeżenie walutowe; `custom` → widełki + czynniki ceny + archetypy z ceną „od”; polityka zwrotu: tekst globalny FA (stała w `src/lib/policies.ts` albo `docs/`) + `weather_policy_text` (O-35)
- [ ] Mobile: S4, S8 jako zwinięte akordeony; S3, S5, S6, S7, S9 rozwinięte; kotwice `#jak-dziala`, `#cena`

## Gotowe, gdy
- [ ] Test renderu: dla seedowej strony `fixed` renderują się S3–S9 w tej kolejności (kotwice/`data-section` w DOM); dla `custom` S6 pokazuje archetypy, S9 widełki — testy komponentów
- [ ] Test „puste pole = brak sekcji”: strona bez `suited_for` i `day_schedule` nie ma S5 i S6 w DOM
- [ ] S7 renderuje tyle kart, ile wierszy `show_on_page=true AND status='active'` — test z 2 przewodnikami; `paused` nie pokazany
- [ ] Tabela w S9 i widget z FA-1.53 dają tę samą kwotę dla (1 dzień, 2 wędkarzy) — test porównawczy
- [ ] `grep -rn "\.from(" "src/app/experiences/[slug]/_v2" src/components/experience-v2` → 0
- [ ] Playwright: zrzut całej strony desktop i mobile (seed `fixed` i `custom`) — ścieżki w raporcie
- [ ] `pnpm typecheck && pnpm lint && pnpm test run && pnpm knip` zielone

## Poza zakresem
- S10–S14, formularz → FA-1.55
- Treść pól (`suited_for`, `day_schedule` dla realnych stron) → wpisuje tj w adminie po FA-1.56
- Pobieranie recenzji → FA-1.55
- Zmiana polityki zwrotu depozytu — O-35 rozstrzygnięte: globalna FA; treść dostarcza tj
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
brak

## Weryfikacja
```
pnpm test -- experience-v2
grep -rn "\.from(" "src/app/experiences/[slug]/_v2" src/components/experience-v2   # 0
ls .playwright-mcp | grep -i v2
pnpm typecheck && pnpm lint && pnpm test run && pnpm knip
```

## Notatki z realizacji
- 2026-10-05 tj: O-34 — S7 pokazuje wszystkich przypiętych przewodników; O-35 — zwrot depozytu globalny FA + wyjątek pogodowy per oferta; O-36 — SLA i ETA oferty per oferta (`response_sla_hours`, `offer_eta_text`).
- 2026-10-07 tj: S9 — globalna polityka zwrotu depozytu = jedna stała z istniejącego tekstu (terms-of-service / offers), strony prawne bez zmian; brak db reset i edycji seed.sql (równolegle FA-1.56 na tym samym stacku).
- 2026-10-07 tj: O-35 — globalny tekst zwrotu jeszcze nieustalony (D); S9 bez linii globalnej, blokuje FA-1.57. (Zastępuje wcześniejszą notatkę o stałej `policies.ts` — nie powstaje.) Kotwice zostają `#jak-dziala` i `#cena`, jak w pliku zadania i FA-1.53.
- 2026-10-07 tj: odbiór PR #136 — przyjęte. Udowodnione: S3–S9 w kolejności (fixed/custom), „puste pole = brak sekcji" (red proof), S7 tylko active + show_on_page (red proof), tabela S9 = widget dla (1 dzień, 2 wędkarzy), 0 `.from(` w v2, typecheck/lint/test/knip + CI zielone. Zrzuty na tymczasowych stronach o kształcie seeda zamiast seedowych (lokalna baza nieaktualna) — przyjęte przez tj; reset lokalnej bazy przed FA-1.55. Pytania o treść (ceny dodatków/archetypów z prowizją czy bez, copy „online by card" / „deposit in EUR through Stripe" / „valid for 72 h", S5 przy samym expectations_text) — do rozstrzygnięcia przed FA-1.57.
