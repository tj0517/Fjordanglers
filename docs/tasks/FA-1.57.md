---
id: FA-1.57
title: Pilot v2 — jedna strona NZ na nowym szablonie (`page_version=2` na prod), dwa tygodnie pomiaru zapytań v1 vs v2; robi tj
stage: 1
status: todo
difficulty: S
model: — (człowiek)
model_approved:
effort:
agent:
branch:
depends_on: [FA-1.53, FA-1.54, FA-1.55, FA-1.56]
blocked_by_questions: []
touches_db: false
touches_prod: true
estimate_h: 3
owner: tj
---

# FA-1.57 — Pilot: jedna strona na v2

## Kontekst — przeczytaj przed startem
- `docs/proposals/2026-10-05-experience-offer-centric.md` §7 krok 3 i bramki przejścia
- `docs/tasks/FA-1.52.md` — flaga `EXPERIENCE_V2_ENABLED` i `page_version`
- `docs/tasks/FA-1.56.md` — gdzie wpisać dane v2
- `docs/REBUILD_PLAN.md` §7 — metryki M1–M6 (zapytania, qualified)
- `/admin/weekly`, `/admin/pipeline` — skąd brać liczby

## Cel
Zanim v2 wejdzie na wszystkie strony, jedna strona NZ (ta, na którą idzie najwięcej ruchu z Ads) ma przez dwa tygodnie zbierać zapytania na nowym szablonie. Porównujemy liczbę i jakość zapytań (`qualified`, wypełniony `brief`) z dwoma tygodniami wcześniej na v1. Rollback to zmiana flagi.

## Zakres
- [ ] Odczyt bieżącego stanu: `SELECT slug, page_version, offer_mode, price_from_cents FROM experience_pages WHERE country='New Zealand'` (prod, wklej); liczba `inquiry.created` z tej strony w ostatnich 14 dniach
- [ ] W adminie (FA-1.56): uzupełnić dla strony pilotażowej cennik, `suited_for`/`not_suited_for`, `day_schedule`, `license_info`, `offer_eta_text`, drugi przewodnik jeśli jest
- [ ] Podgląd `?preview=v2`, poprawki treści
- [ ] `EXPERIENCE_V2_ENABLED=on` w Vercel (prod) + `page_version=2` na stronie pilotażowej
- [ ] Ads: grupa reklam strony pilotażowej bez zmian przez 14 dni (ten sam budżet i słowa)
- [ ] Po 14 dniach: tabela v1 (14 dni przed) vs v2 (14 dni po): `inquiry.created`, `qualified`, odsetek z `brief`, czas do oferty — zapisana w „Notatkach z realizacji”

## Gotowe, gdy
- [ ] Strona pilotażowa renderuje v2 dla anonimowego użytkownika (`curl -s https://fjordanglers.com/experiences/<slug> | grep -c 'data-section="S2"'` ≥ 1) — wklejone
- [ ] Pozostałe strony renderują v1 (ten sam `curl` na innej stronie → 0) — wklejone
- [ ] Co najmniej jedno zapytanie z prod ma `brief` niepusty i zdarzenie `inquiry.created` z `page_version=2` — odczyt wklejony
- [ ] Tabela porównawcza po 14 dniach w notatkach; decyzja tj: rozszerzyć v2 na resztę stron (→ kolejne zadanie), poprawić, albo wyłączyć

## Poza zakresem
- Włączanie v2 na innych stronach — osobne zadanie po decyzji
- Zmiany w kodzie — jeśli pilot wymaga poprawek, wracają jako zadania S
- CONTRACT (drop starych kolumn) — etap 4, `docs/deferred-tasks.md`
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- przed zmianą `EXPERIENCE_V2_ENABLED` w Vercel i przed `UPDATE experience_pages SET page_version=2` na prod — decyzja i wykonanie tj; agent tego nie robi

## Weryfikacja
```
curl -s https://fjordanglers.com/experiences/<slug-pilota> | grep -c 'data-section="S2"'
SELECT count(*) FROM inquiries WHERE experience_page_id='<id>' AND brief IS NOT NULL AND created_at > now() - interval '14 days';
```

## Notatki z realizacji
