---
id: FA-1.85
title: Treść hubów w bazie + edytor w panelu — O-42 przechodzi na (b); konfiguracja w kodzie zostaje tylko dla slug/grupa/kraje
stage: 1
status: review
difficulty: L
model: opus
model_approved: tj 2026-11-11
effort: high
agent: fa-core
branch: feat/fa-1.85-hub-content-table
pr: 188, 189
depends_on: [FA-1.82, FA-1.84]
blocked_by_questions: []
touches_db: true
touches_prod: true
estimate_h: 7
owner: tj
---

# FA-1.85 — Treść hubów w bazie + edytor

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md`
- `docs/02-data-model.md` + `docs/audit/rebuild-audit-db-aug-2026.md`
- `docs/05-agent-operations.md` §3
- `docs/04-open-questions.md` — O-42, O-43, O-44
- `docs/audit/seo-audit-2026-11.md` — F15, D2
- `docs/tasks/FA-1.82.md` — huby w kodzie (stan wyjściowy)
- `docs/tasks/FA-1.84.md` — edytor bloga (komponenty do ponownego użycia)

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Po FA-1.82 tekst hubów (intro, sezon, gatunki, FAQ, meta, cytat) siedzi w `destinations.ts`, więc każda poprawka to PR. Po zadaniu treść redakcyjna hubów żyje w tabeli, a Krzysztof edytuje ją w `/admin/hubs` tym samym edytorem co blog; w kodzie zostaje tylko szkielet (slug, grupa, kraje). Strony hubów wyglądają identycznie przed i po przeniesieniu.

## Zakres
- [ ] Odczyt stanu: pola hubów w `destinations.ts`, czy tabela nie istnieje na prod (SELECT).
- [ ] Tabela treści hubów + RLS (anon i authenticated czytają; brak polityki zapisu — zapis przez akcję serwerową z service role po `requireAdmin()`, jak blog; decyzja tj 2026-11-11 nr 1) — STOP z SQL.
- [ ] Przeniesienie treści 6 hubów z kodu do tabeli (migracja danych) — STOP.
- [ ] Odczyt w `getDestinationHub()` z tabeli; `revalidateTag` po zapisie w panelu.
- [ ] `/admin/hubs`: lista + formularz z polami O-43/O-44.
- [ ] O-42 w `docs/04-open-questions.md` → „(b) od FA-1.85”.

## Gotowe, gdy
- [ ] Tabela i polityki na prod — odczyt wklejony; anon nie zapisuje (red proof).
- [ ] 6 hubów identyczne przed/po w czterech warstwach (zatwierdzone przez tj 2026-11-11 zamiast „identycznego HTML”, bo HTML nie jest bajt w bajt stabilny między dwoma żądaniami): `jsonld`, `head` (bez dwóch tagów Sentry), `body` bez `<script>`, widoczny tekst — `diff` każdej warstwy każdego hubu wklejony (pusty). Plus, jeśli stabilne na dwóch zrzutach bazowych: liczba wystąpień pól redakcyjnych w połączonym ładunku `self.__next_f.push` równa przed/po.
- [ ] Edycja FAQ w panelu → zmiana widoczna na hubie po zapisie — wklejone.
- [ ] CI zielone — lista wklejona.

## Poza zakresem
- Strony regionów i rzek (D5: później).
- Nowe huby poza 6 istniejącymi.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- SQL migracji (tabela, RLS, dane) — pokaż i czekaj.
- Migracja na prod wyłącznie przez `migrate-prod` (tj); kolejność: PR migracyjny → merge → `migrate-prod` → odczyt → PR z kodem.
- Stan bazy ustalasz bieżącym odczytem, nigdy z pamięci, notatek ani pliku typów.

## Weryfikacja
```
for h in norway sweden finland iceland patagonia new-zealand; do curl -s localhost:3000/$h | sed 's/[0-9]\{13\}//g' > /tmp/$h.after; done
```

## Notatki z realizacji
- **2026-11-03, tj:** D2 — treść hubów w tabeli z edytorem; najpierw w kodzie (FA-1.82), tabela razem z edytorem bloga. O-42 wraca na (b).
- **2026-11-11, tj:** Decyzja 1 — zapis jak w blogu: w bazie brak polityki zapisu, zapis przez akcję serwerową z service role po `requireAdmin()`, jeden wiersz `audit_log` na każdy udany zapis. Decyzja 2 — model Opus · high, trudność traktowana jak L (zadanie przenosi dane na produkcję, `docs/05-agent-operations.md` §2). Decyzja 3 — `articles` zostaje w kodzie bez zmian do FA-1.90.
- **2026-11-11, tj:** Tabela `destination_hubs` — SQL zatwierdzony (kolumny, ograniczenia, RLS bez polityki zapisu, REVOKE/GRANT, trigger `updated_at`); pełny plik SQL wklejony w opisie PR migracyjnego, nie streszczenie. Limit opisu meta: **A — 160 w tabeli i w formularzu** (blog blokuje na 155, huby na 160: istniejące opisy Norwegii, Finlandii i Nowej Zelandii mają 160/158/159 znaków). Lokalnie `supabase migration up`, nie `db reset`; reset tylko po zatrzymaniu i zapytaniu tj.
- **2026-11-11, tj:** Porównanie przed/po — cztery warstwy (`jsonld`, `head` bez `sentry-trace` i `baggage`, `body` bez `<script>`, widoczny tekst) zastępują „identyczny HTML”: dwa zrzuty bazowe różnią się per żądanie (trace id Sentry, `__next_r`, dane flight `self.__next_f` ze stosami w trybie dev dzielone w różnych miejscach), a `baggage` zawiera `sentry-release` = SHA commita. Bez buildu produkcyjnego. Dodatkowo: liczba wystąpień każdego pola redakcyjnego (h1, intro, tytuł i opis meta, notka sezonu, pytania i odpowiedzi FAQ) w połączonych ładunkach `self.__next_f.push` — najpierw dowód stabilności na dwóch zrzutach bazowych; jeśli niestabilne — odpada. Ten sam `start-dev.sh` dla zrzutu „po”.
- **2026-11-11, agent:** Tabela ma `id uuid` jako klucz, `slug` unikalny — `audit_log.record_id` jest typu uuid, więc klucz tekstowy (slug) nie zmieściłby się w wierszu audytu; zmiana `audit_log` poza zakresem. Szczegóły i SQL: PR migracyjny #188 (tabela, dane, typy). Czerwony dowód z tego PR-a: oba ograniczenia „wszystko albo nic” (cytat, kontakt) przepuszczały częściowo wypełnione wiersze, bo NULL w CHECK nie odrzuca — naprawione przed merge’em (`IS NOT NULL` przy każdym operandzie), wiersz w deferred.
- **2026-11-11, agent:** Kod czyta treść hubów przez `getHubContents()` (jedno zapytanie o sześć wierszy, tag cache `hubs`, `revalidate` 300 s). Błąd odczytu **rzuca** (strona hubu zostaje przy ostatniej dobrej wersji — ISR), brak wiersza dla hubu z kodu też; breadcrumb strony oferty (`getHubCrumbForCountry`) przy błędzie spada do „Trips” i loguje — oferta nie ma padać przez etykietę rodzica. Odkryty po drodze konsument: breadcrumb JSON-LD stron ofert używał `h1` huba z kodu; porównane przed/po na dwóch lokalnych ofertach (Islandia, Nowa Zelandia) — pusty diff.
- **2026-11-11, agent:** `saveHubContent`: bez „nowy hub” i bez usuwania; slug spoza `DESTINATION_HUBS` i hub bez wiersza są odrzucane; zapis bez zmian nie pisze wiersza audytu ani nie odświeża cache (porównanie pól kanoniczne — `jsonb` zwraca klucze w innej kolejności, więc `JSON.stringify` widziałby zmianę przy każdym zapisie; wychwycone testem). `audit_log`: zmienione pola w całości (pola hubów są krótkie), nie hash jak treść artykułu.
- **2026-11-11, agent:** Limity w tabeli i w formularzu: nagłówek 120, intro 1500, tytuł meta 60, opis meta 160 (decyzja tj A), notka sezonu 600, pytanie 200, odpowiedź 1500, ≤ 12 pytań, ≤ 20 gatunków. Powtórzone miesiące odrzuca zod (CHECK nie może mieć podzapytania).

