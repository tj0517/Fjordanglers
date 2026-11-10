---
id: FA-M.03
title: Zlecenie do przewodnika w bazie — rekord zlecenia z podpisanym tokenem, zdarzenia wysłano/otwarto/odpowiedział, skrót na `inquiries`
stage: M
status: todo
difficulty: L
model: opus
model_approved:
effort: high
agent: fa-db
branch: db/fa-m.03-guide-requests
depends_on: []
blocked_by_questions: []
touches_db: true
touches_prod: true
estimate_h: 8
owner: tj
---

# FA-M.03 — Zlecenie do przewodnika w bazie

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md`
- `docs/02-data-model.md`, `docs/audit/rebuild-audit-db-aug-2026.md` — `requests`/`request_guides` to resztki marketplace (nie używać, nie usuwać tutaj)
- `docs/01-architecture.md` §3–4, `docs/REBUILD_PLAN.md` załącznik C — zdarzenia i maszyna stanów
- `src/lib/events/types.ts`, `src/lib/events/emit.ts` — typy zdarzeń (`guide.assigned/accepted/declined` zdefiniowane, nieużywane)
- `src/actions/inquiries.ts` (`assignGuideToInquiry`, `unassignGuide`) — dzisiejsze przypisanie przewodnika
- `inquiries`: `assigned_guide_id`, `guide_acceptance`, `guide_responded_at`, `guide_decline_reason`, `guide_offer_eta`
- `docs/04-open-questions.md` O-51–O-53
- Dokument „Aplikacja dla przewodników — zakres MVP” — przepływ i funkcje 3, 6

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Dziś zapytanie ma jedno pole „przewodnik” i jedno „zaakceptował/odrzucił”; po zmianie przewodnika historia znika, a czasu odpowiedzi nie da się zmierzyć. Po zadaniu każde zlecenie do przewodnika to osobny rekord (O-52 → a): kto, kiedy wysłano, kiedy otwarto link, kiedy i co odpowiedział (akceptuje / odrzuca + powód / inne daty 1–3), z podpisanym tokenem do strony bez logowania. Pola przewodnika na `inquiries` zostają jako skrót ostatniego zlecenia. To fundament FA-M.04–M.06 i miary MVP.

## Zakres
- [ ] Odczyt stanu: schemat `inquiries` (pola przewodnika), polityki RLS, istniejące typy zdarzeń; odczyt prod: ile zapytań ma `assigned_guide_id`, rozkład `guide_acceptance`.
- [ ] Migracja: tabela zleceń (nazwę proponuje agent, np. `guide_requests`): `inquiry_id`, `guide_id`, `token_hash` (token przechowywany wyłącznie jako hash), `token_expires_at`, `channel`, `sent_at`, `first_opened_at`, `answered_at`, `answer` (accepted / declined / other_dates), `alt_dates` (0–3 daty), `decline_reason`, `reminded_at`, znaczniki czasu; RLS w tej samej migracji (admin pełny dostęp, anon/authenticated brak — strona zlecenia działa kluczem serwisowym po weryfikacji tokenu).
- [ ] Warstwa danych w `src/lib/…` (bez `.from(` w `src/app`): utwórz zlecenie (zwraca token jawnie jeden raz), znajdź po tokenie, zapisz otwarcie (tylko pierwsze), zapisz odpowiedź (jednokrotnie, idempotentnie), synchronizacja skrótu na `inquiries`.
- [ ] Zdarzenia: `guide.request_sent`, `guide.request_opened`, `guide.request_answered` (payload: answer, alt_dates), emitowane przy każdej mutacji; istniejące `guide.accepted/declined` — agent proponuje, czy emitować równolegle (decyzja tj).
- [ ] Typy (`supabase gen types`).
- [ ] Testy z red proofami (lokalny stack).

## Gotowe, gdy
- [ ] Token nie jest zapisany jawnie: `select` z tabeli zleceń nie zawiera tokenu, tylko hash — **jak sprawdzić:** test + `grep -n token supabase/migrations/<nowa>.sql`.
- [ ] Zły, wygasły lub cudzy token → brak dostępu do zlecenia; pokazane na czerwono — **jak sprawdzić:** nazwy testów + wynik.
- [ ] Druga odpowiedź na to samo zlecenie nie nadpisuje pierwszej (idempotencja); pokazane na czerwono na kodzie bez zabezpieczenia — **jak sprawdzić:** test.
- [ ] `alt_dates` przyjmuje 0–3 daty w przyszłości, odrzuca 4 i daty z przeszłości; pokazane na czerwono — **jak sprawdzić:** test.
- [ ] `anon` i `authenticated` nie czytają ani nie zapisują tabeli zleceń — **jak sprawdzić:** test sesją `angler@seed.test` + odczyt polityk na prod po `migrate-prod`.
- [ ] Każda mutacja emituje zdarzenie; odpowiedź aktualizuje skrót na `inquiries` — **jak sprawdzić:** test czytający `inquiry_events` i `inquiries` po akcji.

## Poza zakresem
- Strona zlecenia `/r/[token]` → FA-M.04. Wysyłka WhatsApp i przycisk w adminie → FA-M.05. Ponaglenie → FA-M.06.
- Usunięcie `requests`/`request_guides` i pól przewodnika z `inquiries` → etap 4 (deferred).
- Wysyłka do kilku przewodników naraz w UI → po MVP (model danych ją umożliwia).
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Przed migracją — schemat tabeli i polityki do akceptacji tj.
- `db push` na prod wyłącznie przez `deploy-db.yml` (`migrate-prod`, zatwierdza tj) — agent go nie uruchamia; kolejność migracja → kod wg `docs/05-agent-operations.md` §3.
- Stan bazy ustalasz bieżącym odczytem, nigdy z pamięci, notatek ani pliku typów.

## Weryfikacja
```
ls supabase/migrations | tail -3
git diff main...HEAD -- src/lib/supabase/database.types.ts --stat
pnpm test -- guide-requests
SELECT policyname, cmd, roles, qual, with_check FROM pg_policies WHERE tablename = '<tabela zleceń>';
```

## Notatki z realizacji
- **2026-11-10, tj (wf-plan):** O-52 → (a) nowy rekord zlecenia; pola na `inquiries` zostają skrótem.
