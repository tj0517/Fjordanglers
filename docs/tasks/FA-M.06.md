---
id: FA-M.06
title: Ponaglenie — po 12 h (sezon) / 24 h (poza sezonem) bez otwarcia linku jedno automatyczne WhatsApp do przewodnika + flaga dla admina
stage: M
status: todo
difficulty: M
model: sonnet
model_approved:
effort: medium
agent: fa-core
branch: feat/fa-m.06-request-reminder
depends_on: [FA-M.05]
blocked_by_questions: [O-55]
touches_db: false
touches_prod: true
estimate_h: 4
owner: tj
---

# FA-M.06 — Ponaglenie przewodnika

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md`
- `docs/tasks/FA-M.03.md`, `docs/tasks/FA-M.05.md`
- `vercel.json` (`crons`), `src/app/api/cron/offer-sla` — wzór crona
- `experience_pages.season_months`, `src/lib/season-months.ts` — miesiące sezonu
- `src/app/admin/inquiries/InquiriesClient.tsx` — filtry listy zapytań
- `docs/04-open-questions.md` O-53, O-55

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Przewodnicy w sezonie nie ignorują FA, tylko są zajęci — jedno przypomnienie skraca czas odpowiedzi. Jeśli przewodnik nie otworzy linku zlecenia w 12 h (w sezonie) albo 24 h (poza sezonem), dostaje jedno automatyczne WhatsApp z tym samym linkiem, a admin widzi na liście zapytań flagę „przewodnik nie otworzył” (O-53 → c).

## Zakres
- [ ] Odczyt stanu: crony w `vercel.json`, wzór `offer-sla`, plan Vercel (O-55 — czy crony mogą chodzić częściej niż raz dziennie).
- [ ] Reguła sezonu: miesiąc daty zlecenia w `season_months` stron oferty przewodnika → 12 h, inaczej 24 h; brak danych → 24 h. Reguła w jednej funkcji z testami.
- [ ] Zadanie cykliczne (mechanizm wg O-55): znajduje zlecenia bez otwarcia po progu i bez `reminded_at`, wysyła jedno ponaglenie przez `sendMessage`, zapisuje `reminded_at`, emituje zdarzenie (np. `guide.request_reminded`).
- [ ] Lista zapytań w adminie: flaga / filtr „przewodnik nie otworzył po progu”.
- [ ] Testy (fake WhatsApp, sterowany zegar).

## Gotowe, gdy
- [ ] Zlecenie bez otwarcia po progu dostaje dokładnie jedno ponaglenie, nawet przy wielokrotnym uruchomieniu crona; pokazane na czerwono (drugie uruchomienie bez zabezpieczenia wysyła drugi raz) — **jak sprawdzić:** test.
- [ ] Zlecenie otwarte albo z odpowiedzią nie dostaje ponaglenia — **jak sprawdzić:** test.
- [ ] Próg 12 h / 24 h zgodny z regułą sezonu dla przypadków: w sezonie, poza sezonem, brak danych — **jak sprawdzić:** test funkcji.
- [ ] Endpoint crona wymaga sekretu crona (jak `offer-sla`); bez niego 401 — **jak sprawdzić:** test / `curl` lokalnie.
- [ ] Flaga na liście zapytań widoczna dla zlecenia po progu — **jak sprawdzić:** zrzut + test filtra.

## Poza zakresem
- Ponaglenie przez push → FA-M.12 (może korzystać z tej samej reguły).
- Drugie i kolejne ponaglenia, eskalacja do innego przewodnika → po MVP.
- Ponaglenie, gdy przewodnik otworzył, a nie odpowiedział → po MVP.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Zmiana `vercel.json` (`crons`) albo zewnętrznego harmonogramu → pokazać tj przed merge (wg O-55).
- Żadnej prawdziwej wysyłki z dev/testów.

## Weryfikacja
```
pnpm test -- request-reminder season-threshold
grep -n "path" vercel.json
```

## Notatki z realizacji
- **2026-11-10, tj (wf-plan):** 12 h w sezonie / 24 h poza; ponaglenie do przewodnika i flaga dla admina (O-53 → c).
