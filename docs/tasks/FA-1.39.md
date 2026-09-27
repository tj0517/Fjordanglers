---
id: FA-1.39
title: Uzupełnienie historii na produkcji — tj wpisuje wpłaty, oferty, daty i przegrane wg `/admin/data-gaps`; sumy vs Stripe/księgowość
stage: 1
status: todo
difficulty: M
model: — (człowiek)
model_approved:
effort:
agent: —
branch: docs/fa-1.39-history-filled
depends_on: [FA-1.35, FA-1.36, FA-1.37, FA-1.38]
blocked_by_questions: []
touches_db: true
touches_prod: true
estimate_h: 4
owner: tj
---

# FA-1.39 — Historia na produkcji mówi prawdę

## Kontekst — przeczytaj przed startem
- `/admin/data-gaps` (FA-1.36) — lista do przejścia i miara ukończenia
- `docs/RUNBOOK-backup.md` — backup przed startem
- Źródła prawdy (poza repo): dashboard Stripe (wpłaty, daty, kwoty), konto bankowe (przelewy poza Stripe), skrzynka e-mail i WhatsApp (daty zapytań i ofert), ewidencja księgowa (przychód miesięczny IV–IX 2026), konto Google Ads (wydatki)
- `docs/deferred-tasks.md` wiersze „FA-1.05 audit”

## Cel
Kod z FA-1.35–1.38 jest na produkcji; teraz dane. tj przechodzi listę braków i wpisuje każdy fakt ze źródła, na karcie zapytania, z prawdziwą datą. Na końcu wykresy na `/admin/weekly`, `/admin/finances` i `/admin/pipeline` zgadzają się ze sobą i ze źródłem prawdy.

## Zakres
- [ ] Warunek wstępny: FA-1.35–1.38 zmergowane do `main` i wdrożone na produkcję; SHA wdrożenia w notatkach.
- [ ] Backup wg `docs/RUNBOOK-backup.md`; ścieżka backupu w notatkach.
- [ ] Zapis stanu przed: liczniki A–F z `/admin/data-gaps` + prowizja miesięczna IV–IX z `/admin/finances`.
- [ ] Kategoria A/B — wpłaty: dla każdego zapytania data i kwota ze Stripe/banku → „Zapisz wpłatę z przeszłości”.
- [ ] Kategoria C — oferty: data z maila/WhatsAppa → „data oferty”.
- [ ] Kategoria D — przegrane: kod + data.
- [ ] Kategoria E — daty wpływu z pierwszej wiadomości; F — `qualified` ustawiane istniejącą kontrolką (opcjonalnie).
- [ ] Wydatki na reklamy: miesięczne sumy `/admin/ads` vs konto Google Ads (i inne kanały płatne, jeśli były); braki dopisane istniejącym ręcznym wpisem na `/admin/ads`.
- [ ] Zapytanie bez źródła → notatka na karcie „brak źródła” i wiersz w „Notatkach z realizacji”, zamiast zgadywania.

## Gotowe, gdy
- [ ] `/admin/data-gaps`: A, B, C, D = 0 albo każdy pozostały wiersz jest w notatkach z powodem „brak źródła” (zrzut).
- [ ] Tabela w notatkach: prowizja miesięczna IV–IX z `/admin/finances` obok referencji (Stripe/księgowość), różnice wyjaśnione.
- [ ] Liczba bookingów IV–IX identyczna na `/admin/weekly` (miesiąc bieżący), `/admin/finances` i `/admin/pipeline` (trzy liczby w notatkach).
- [ ] `SELECT type, count(*) FROM inquiry_events WHERE source = 'backfill' AND created_at > '<data startu>' GROUP BY 1` wklejone — liczba zdarzeń zgadza się z liczbą wpisów.
- [ ] Wydatki na reklamy per miesiąc zgodne z kontem reklamowym (tabela w notatkach).

## Poza zakresem
- SQL na produkcji inny niż SELECT — nie; wszystko przez UI (każdy wpis zostawia zdarzenie).
- Korekta wpłat już zarejestrowanych przez webhook — osobne zadanie.
- Przeliczanie historii na `deals`/`payments` — etap 4 (dane z tego zadania przejdą wg załącznika B).
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Przed pierwszym wpisem: backup produkcji wykonany i zweryfikowany.
- Jeśli prowizja miesięczna po uzupełnieniu różni się od referencji o więcej niż jeden booking — STOP, najpierw wyjaśnij różnicę, potem kolejne wpisy.
- Wpisy wyłącznie przez UI aplikacji; zero `UPDATE`/`INSERT` ręcznie.

## Weryfikacja
```
/admin/data-gaps            # A–D = 0
/admin/finances             # prowizja IV–IX vs referencja
select type, count(*) from inquiry_events where source = 'backfill' and created_at > '<start>' group by 1;
```

## Notatki z realizacji
- 2026-09-27 tj (wf-plan): cel = każdy rekord osobno (D1).
