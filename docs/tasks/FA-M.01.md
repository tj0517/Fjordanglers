---
id: FA-M.01
title: Baseline przed startem aplikacji przewodników — czas zapytanie → oferta i close rate z prod
stage: M
status: done
difficulty: S
model: —
model_approved:
effort:
agent: — (Claude w app, odczyt przez konektor Supabase)
branch:
depends_on: []
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 1
owner: tj
---

# FA-M.01 — Baseline przed startem

## Kontekst — przeczytaj przed startem
- `docs/tasks/FA-M.03.md` — zdarzenia zlecenia, z których po starcie liczy się te same miary
- Dokument „Aplikacja dla przewodników — zakres MVP” (Claude Docs, sekcja „Cel i założenia”) — wynik wpisany tam

## Cel
Zapisać punkt odniesienia dla miary sukcesu MVP (czas zapytanie → oferta, close rate) przed startem 1.12, żeby po starcie porównać te same zapytania SQL na nowej kohorcie.

## Zakres
- [x] Odczyt prod (tylko SELECT): zdarzenia `inquiry_events`, kolumny `inquiries.created_at`, `deposit_paid_at`, `qualified`.
- [x] Wynik wpisany do dokumentu MVP.

## Gotowe, gdy
- [x] Tabela baseline w dokumencie MVP z n i definicją każdej miary — **jak sprawdzić:** sekcja „Cel i założenia” dokumentu.

## Poza zakresem
- Dashboard z tymi miarami w adminie → po MVP (REBUILD_PLAN §7).
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
brak (tylko SELECT)

## Weryfikacja
```sql
-- close rate, zapytania starsze niż 30 dni
select count(*) n, count(deposit_paid_at) paid from inquiries where created_at < now() - interval '30 days';
-- zapytanie → pierwsze zdarzenie oferty (mediana, h)
with f as (select inquiry_id, type, min(occurred_at) t from inquiry_events
           where type in ('guide.offer_received','offer.presented') group by 1,2)
select f.type, count(*), percentile_cont(0.5) within group (order by f.t - i.created_at)
from f join inquiries i on i.id = f.inquiry_id where f.t >= i.created_at group by 1;
-- prośba do przewodnika → jego oferta
with w as (select inquiry_id, min(occurred_at) t from inquiry_events where type='status.changed' and to_status='waiting_guide' group by 1),
     o as (select inquiry_id, min(occurred_at) t from inquiry_events where type='guide.offer_received' group by 1)
select count(*), percentile_cont(0.5) within group (order by o.t - w.t) from w join o using (inquiry_id) where o.t >= w.t;
```

## Notatki z realizacji
- **2026-11-10, Claude (wf-plan, zgoda tj):** odczyt prod przez konektor Supabase w app. Wynik: close rate 24,8% (30/121, zapytania > 30 dni); kohorta IX–początek X 32,5% (13/40); zapytanie → `offer.presented` mediana 138 h (n=19, IQR 34–250 h); zapytanie → `guide.offer_received` 228 h (n=14); `waiting_guide` → `guide.offer_received` 180 h (n=5). Zastrzeżenie: część ofert szła ręcznie poza stroną, `offer_sent_at` prawie puste.
- **2026-11-10, Claude:** project.md (`db.note`) mówi, że FA nie jest podpięte pod konektor Supabase w app — w tej sesji konektor działał (odczyt). Do poprawy w project.md.
- Po starcie (od 1.12): te same zapytania + `guide.request_sent` → `guide.request_answered` z FA-M.03.
