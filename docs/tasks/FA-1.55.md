---
id: FA-1.55
title: Szablon v2 — dół strony (S10–S14) i formularz 3-krokowy: recenzje z linkiem zewnętrznym, mapa i sezon, co zabrać, FAQ, zapytanie z `brief`; aliasy slugów
stage: 1
status: todo
difficulty: L
model: opus
model_approved:
effort: high
agent: fa-core
branch: feat/experience-v2-form
depends_on: [FA-1.54]
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 10
owner: tj
---

# FA-1.55 — v2: S10–S14 + formularz zapytania

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md`, `docs/01-architecture.md` §3–4 (zdarzenia, maszyna stanów)
- `docs/proposals/2026-10-05-experience-offer-centric.md` §2 „Co z inquiries” (klucze `brief`), §7 krok 3
- Wireframe: artboardy Desktop S10–S14, Mobile, „Kreator zapytania, krok 1 z 3”
- `src/lib/inquiries/create.ts` + `src/app/api/inquiries/route.ts` — jedyna ścieżka tworzenia zapytania (FA-0.05), limiter (FA-1.41), honeypot i czas (FA-1.43), auto-odpowiedź z formularza (FA-1.40, FA-1.46)
- `src/lib/inquiries/state.ts` — `transition()`, `emitEvent`
- `src/components/inquiry-form/*` (albo obecny formularz na v1) — co dziś wysyła formularz
- `src/actions/reviews.ts`, tabela `reviews` + `reviews.experience_id` (FA-1.50)
- `src/lib/ai/draft-reply.ts` — agent czyta formularz; `brief` ma być dla niego widoczny

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Dół strony domyka zaufanie (recenzje z linkiem do Google, mapa, sezon, FAQ) i prowadzi do zapytania, które kwalifikuje klienta zanim trafi do przewodnika: daty (konkretne / elastyczne), dni, osoby, poziom z opisem behawioralnym, priorytet, kondycja i akceptacja budżetu. Odpowiedzi lądują w `inquiries.brief`, a zapytanie przechodzi dokładnie tą samą ścieżką (limiter, honeypot, auto-odpowiedź), co dziś. Stary formularz na v1 działa bez zmian.

## Zakres
- [ ] Odczyt bieżącego stanu: `route.ts` i `create.ts` — jakie pola przyjmuje API i jak waliduje; jak FA-1.40/1.46 budują blok formularza dla agenta; schemat `brief` z FA-1.50
- [ ] S10 Recenzje: `reviews` dla `experience_id` lub dla przewodników z `experience_guides`, 3–6 z imieniem, krajem, datą, zdjęciem; link „Zobacz wszystkie na Google” z `guides.google_profile_url` primary; mobile: karuzela
- [ ] S11 Mapa + logistyka: mapa z `location_lat/lng` (istniejący komponent mapy, jeśli jest po FA-1.07; inaczej statyczny obraz z zewnętrznego dostawcy — zgłoś), `nearest_airport`, `suggested_lodging`, pasek 12 miesięcy z `season_months`/`peak_months`
- [ ] S12 Co zabrać: `what_to_bring`; S13 FAQ: `faq` jako akordeon + stałe pytanie „przez FA vs bezpośrednio” (treść z tj)
- [ ] S14 Formularz inline (krok 1) + ten sam formularz jako pełnoekranowy kreator z CTA widgetu (mobile: bottom sheet → full screen), pasek postępu 1/3, stan zapamiętany między krokami (URL state albo `sessionStorage`)
- [ ] Kroki wg propozycji: 1) daty `exact|flexible` + miesiąc, dni, wędkarze, niewędkujący; 2) `skill_level` z opisem behawioralnym, `priority`, `fitness`, `wading_ok`, `budget_ack` (fixed: checkbox z ceną „od”; custom: `budget_band`); 3) imię, e-mail, kraj, telefon/WhatsApp (opc.), „coś jeszcze” (opc.); UTM/gclid z istniejącego mechanizmu, nie z pytań
- [ ] Walidacja `brief` w kodzie (zod) w `src/lib/inquiries/brief.ts`; `create.ts` przyjmuje `brief` opcjonalnie — stary formularz go nie wysyła
- [ ] Mapowanie na stare kolumny, żeby nic nie zepsuć: `requested_dates`, `party_size`, `message` (z „coś jeszcze” + skrót brief), `trip_length`; `experience_page_id`; `inquiries.guide_id` = przewodnik `primary` (do CONTRACT)
- [ ] Zdarzenie `inquiry.created` z `metadata.page_version=2` i `metadata.brief_completed=true` (brak nowych typów zdarzeń)
- [ ] Agent (`draft-reply`, `auto-send`): blok formularza zawiera `brief` w czytelnej formie, tak jak dziś pola formularza (FA-1.46)
- [ ] Strona podziękowania: SLA z `response_sla_hours`, link do licencji z `license_info`

## Gotowe, gdy
- [ ] Test API: POST z `brief` tworzy zapytanie z `brief` zapisanym 1:1 i starymi kolumnami wypełnionymi; POST bez `brief` (stary formularz) działa jak na `main` — oba testy
- [ ] Red proof: `brief` z `skill_level=7` albo bez `dates_mode` → 400, zapytanie **nie** powstaje — wklejony wynik
- [ ] Limiter, honeypot i minimalny czas działają dla v2 — istniejące testy FA-1.41/1.43 rozszerzone o żądanie z `brief`, zielone
- [ ] Zdarzenie `inquiry.created` z `page_version=2` w `inquiry_events` po wysłaniu — odczyt z lokalnej bazy wklejony
- [ ] Test `draft-reply`: blok wejścia agenta zawiera priorytet i poziom z `brief` — czerwony na `main`, zielony po zmianie
- [ ] Alias slugu z FA-1.52 pokrywa link z formularza (`experience_page_id` zawsze kanoniczny) — test
- [ ] Playwright: przejście 3 kroków na mobile 390 (lokalny seed), zrzuty każdego kroku i strony podziękowania; stan zachowany po cofnięciu z kroku 2 do 1 — ścieżki w raporcie
- [ ] `grep -rn "\.from(" "src/app/experiences/[slug]/_v2" src/components/experience-v2 src/components/inquiry-wizard` → 0
- [ ] `pnpm typecheck && pnpm lint && pnpm test run && pnpm knip` zielone

## Poza zakresem
- Automatyczne odrzucanie początkujących po `skill_level` — tylko zapis; decyzja o filtrze później
- Admin pokazujący `brief` na karcie zapytania — zgłoś do `deferred` jeśli brak; nie buduj
- Nowe typy zdarzeń
- Zmiana progu sędziego / reguł auto-wysyłki (FA-1.27, FA-1.47)
- Zbieranie recenzji → istniejący mechanizm (FA `reviews`); tu tylko wyświetlanie
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
brak (bez migracji; `brief` istnieje od FA-1.50)

## Weryfikacja
```
pnpm test -- inquiries brief draft-reply experience-v2
grep -rn "\.from(" "src/app/experiences/[slug]/_v2" src/components/experience-v2 src/components/inquiry-wizard   # 0
psql "$LOCAL_DB" -c "SELECT type, metadata->>'page_version' FROM inquiry_events ORDER BY created_at DESC LIMIT 3"
ls .playwright-mcp | grep -i wizard
pnpm typecheck && pnpm lint && pnpm test run && pnpm knip
```

## Notatki z realizacji
