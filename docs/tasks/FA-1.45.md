---
id: FA-1.45
title: Włączenie auto-odpowiedzi — lista kontrolna: dev, pierwsza wysyłka na własny adres, flaga na prod, monitoring, wyłączenie; robi tj
stage: 1
status: todo
difficulty: S
model:
model_approved:
effort:
agent:
branch:
depends_on: [FA-1.41, FA-1.42, FA-1.43, FA-1.44]
blocked_by_questions: []
touches_db: false
touches_prod: true
estimate_h: 2
owner: tj
---

# FA-1.45 — Włączenie `AI_AUTO_REPLY_ENABLED` (robi tj)

## Kontekst — przeczytaj przed startem
- `docs/tasks/FA-1.40.md` … `FA-1.44.md` — co zostało zbudowane i zmierzone
- `docs/tasks/FA-1.27.md` — notatka z odbioru: pierwsza wysyłka ≥ 0.9 z prawdziwym sędzią na adres tj, przed włączeniem na prod
- `docs/05-agent-operations.md` §3, §11 — STOP, środowisko dev

## Cel
Flaga `AI_AUTO_REPLY_ENABLED` jest włączana na prod świadomie, po sprawdzeniu limitów, sufitu kosztów i wyniku baterii sędziego, z gotowym sposobem monitorowania i wyłączenia. To zadanie człowieka: ustawienia w Vercelu i Upstashu należą do tj.

## Zakres
- [ ] Zadania FA-1.41–1.44 zmergowane do `main`, wyniki baterii (FA-1.44) przeczytane i zaakceptowane przez tj.
- [ ] Upstash: baza utworzona; w Vercelu (Preview/dev najpierw, potem Production) ustawione `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `RATE_LIMIT_SALT`, `AI_AUTO_SEND_DAILY_CAP` (start: 5).
- [ ] Dev (`fjordanglers-dev`, Preview): flaga włączona tylko tam; kilka zapytań z formularza; jedno z prawdziwym Resend na własny adres; sprawdzić wygląd maila (temat, treść, nadawca).
- [ ] Test limitu na dev: seria żądań ponad próg → 429 (np. 7 żądań `curl` w 10 minut), bez zapisów i wywołań AI.
- [ ] Zapytanie monitorujące (odczyt, tylko SELECT): liczba zdarzeń `agent.auto_send_decided` z ostatnich 24 h w podziale na wysłane / wstrzymane / powód — ułożone wg `docs/02-data-model.md` i zapisane w opisie zadania.
- [ ] Sposób wyłączenia: wyłączenie flagi w Vercelu wymaga redeployu; ustalone, kto i jak to robi, zanim flaga pójdzie na prod.
- [ ] Prod: flaga włączona; pierwsze 10–20 prawdziwych zapytań przeglądane zapytaniem monitorującym i ręcznie.

## Gotowe, gdy
- [ ] Wszystkie punkty zakresu odhaczone, z dowodem: wynik zapytania monitorującego z dev i z prod, zrzut pierwszego maila, wynik testu 429.
- [ ] Zapisana decyzja „włączamy / zostaje wyłączone” z datą w notatkach.

## Poza zakresem
- Zmiany kodu — jeśli test coś wykryje, nowe zadanie.
- Zmiana sędziego lub progu → osobne zadanie z bramką STOP.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Każda zmiana zmiennych w Vercelu i Upstashu oraz włączenie flagi na prod — decyzja i wykonanie tj.
- Pierwsza prawdziwa wysyłka tylko na adres tj.

## Weryfikacja
```
SELECT-y z zapytania monitorującego (dev i prod, tylko odczyt)
curl w pętli na dev: 7 żądań w 10 minut → 429
```

## Notatki z realizacji
