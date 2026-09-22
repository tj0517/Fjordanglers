---
id: FA-1.22
title: Baza wiedzy agenta w bazie danych — tabela wpisów (instrukcje, ton, kraj, przewodnik), dostęp tylko dla admina
stage: 1
status: todo
difficulty: L
model: opus
model_approved:
effort: high
agent: fa-core
branch: db/agent-knowledge
depends_on: [FA-1.14]
blocked_by_questions: []
touches_db: true
touches_prod: false
estimate_h: 6
owner: tj
---

# FA-1.22 — Baza wiedzy agenta w bazie danych

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md` — konwencje migracji
- `docs/02-data-model.md` + `docs/audit/rebuild-audit-db-aug-2026.md`
- `docs/knowledge/README.md` — dzisiejszy format plików (rodzaje, reguły wyboru) — to jest specyfikacja, którą przenosimy do tabeli
- `src/lib/countries.ts` — `COUNTRIES`, jedyna lista krajów
- `supabase/migrations/20260904165037_baseline_prod.sql` — wzorzec polityk admina (`profiles.role = 'admin'`), tabela `guides`
- `docs/04-open-questions.md` — O-20, O-21, O-22 (rozstrzygnięte 22 IX)

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Decyzja tj 22 IX: wiedza agenta żyje w bazie, nie w plikach repo — edycja bez gita i
deployu, jedno źródło prawdy. To zadanie tworzy tabelę i jej zasady; loader (FA-1.23) i
panel (FA-1.24) są osobno. Baza sama pilnuje, żeby wpis dało się załadować: kraj tylko z
listy obsługiwanych, przewodnik wskazany identyfikatorem, a nie nazwiskiem (literówka w
nazwisku nie gubi już wpisu po cichu), najwyżej jedne aktywne instrukcje.

## Decyzje tj (22 IX)
- D1 = cała wiedza w bazie + panel (opcja C).
- D2 = instrukcje agenta (graf, prompt) też są wpisem — rodzaj `instructions` (O-20).
- D3 = stawki przewodników jako tekst we wpisie; pola strukturalne w etapie 4 (O-21).
- D4 = bez historii zmian; wpis ma tylko „kto i kiedy zmienił ostatnio” (O-22).

## Zakres
- [ ] Odczyt stanu: lista tabel lokalnie, polityki admina w baseline, `guides` (klucz), czy nazwa tabeli jest wolna.
- [ ] Migracja: tabela `agent_knowledge` — `id`, `kind` (`instructions` | `tone` | `destination` | `guide`), `country` (NULL albo wartość z `COUNTRIES`), `guide_id` (FK → `guides`), `title`, `body` (markdown), `active` (default true), `updated_by` (FK → `auth.users`), `created_at`, `updated_at`.
- [ ] Reguły w bazie: `destination` wymaga `country`; `guide` wymaga `guide_id`; `instructions`/`tone` bez `country` i `guide_id`; najwyżej jeden aktywny wpis `instructions`; `updated_at` ustawiane przy każdej zmianie.
- [ ] RLS w tej samej migracji: odczyt i zapis wyłącznie dla admina; brak dostępu dla `anon`, przewodnika i klienta.
- [ ] Seed lokalny: jeden aktywny wpis `instructions` (treść = dzisiejszy `STUB_PROMPT`), jeden `tone`, jeden `destination` dla kraju z seedu, jeden `guide` dla przewodnika z seedu. Treść fikcyjna.
- [ ] Typy zregenerowane; `docs/02-data-model.md` uzupełniony o tabelę.

## Gotowe, gdy
- [ ] `supabase db reset` lokalnie przechodzi; `SELECT kind, count(*) FROM agent_knowledge GROUP BY 1` pokazuje wpisy z seedu (wynik w raporcie).
- [ ] Red proof, każdy jako INSERT/UPDATE z komunikatem błędu w raporcie: `destination` bez `country`; `country='NZ'`; `guide` bez `guide_id`; drugi aktywny `instructions`.
- [ ] Red proof RLS: SELECT jako zalogowany nie-admin (klient z seedu) → 0 wierszy; INSERT jako nie-admin → odrzucony. Ten sam SELECT jako admin → wiersze.
- [ ] `updated_at` zmienia się po UPDATE (dwa odczyty w raporcie).
- [ ] Typy w diffie (`database.types.ts`); CI „typy bez dryfu” zielone.
- [ ] `pnpm typecheck && pnpm lint && pnpm test` zielone.

## Poza zakresem
- Czytanie tabeli przez agenta, usunięcie `docs/knowledge/` → FA-1.23.
- Ekran edycji → FA-1.24.
- Pola stawek, `expedition_guides` (tabela nieużywana w kodzie) → etap 4.
- Historia zmian wpisów (D4).
- Wpisanie prawdziwej treści → FA-1.17 / FA-1.26 (tj przez panel).
- Zdarzenia w `inquiry_events` — edycja wiedzy nie jest zdarzeniem zapytania.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Przed napisaniem migracji: pokaż projekt tabeli, reguł i polityk (SQL) i czekaj na akceptację tj.
- Nowa migracja: tylko lokalnie. `db push` na prod — STOP, robi tj w paczce etapu 1.
- Edycja istniejącej migracji: STOP.
- Stan bazy ustalasz bieżącym odczytem, nigdy z pamięci, notatek ani pliku typów.

## Weryfikacja
```
supabase db reset
psql … -c "SELECT kind, country, guide_id IS NOT NULL AS has_guide, active FROM agent_knowledge"
# red proofs: INSERT-y z błędami, SELECT jako nie-admin
pnpm typecheck && pnpm lint && pnpm test
```

## Notatki z realizacji
