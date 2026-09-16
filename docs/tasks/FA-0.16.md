---
id: FA-0.16
title: SLA 48 h — obietnica terminu w auto-mailu, licznik i alarm w adminie, `lost_reason` jako lista
stage: 0
status: done
difficulty: M
model: sonnet
model_approved:
effort: medium
agent: fa-core
branch: feat/offer-sla-48h
depends_on: []
blocked_by_questions: []
touches_db: true
touches_prod: true
estimate_h: 6
owner: tj
---

# FA-0.16 — SLA 48 h i `lost_reason` jako lista

**Skąd to zadanie (audyt lejka 5 IX 2026).** 84 zapytania → 28 z ofertą (33%) → 14 wygranych.
49 z 56 przegranych przepadło **zanim wyszła jakakolwiek oferta** (19 „klient zamilkł",
11 brak/wolny przewodnik, 10 zmiana planów, 6 cena). Mediana od zapytania do przypisania
przewodnika: **9 dni** (n=30). Po wysłaniu oferty wygrywamy 2 z 3 rozstrzygniętych. Cena jako
powód przegranej po ofercie: 1 raz. Przeciek jest po formularzu, nie przed nim.

Dodatkowo `lost_reason` to wolny tekst („why? -> info on Tymon's whatsup"), więc kategorie
powyżej to ręczna klasyfikacja 56 wpisów — nie da się jej powtórzyć w SQL.

## Kontekst — przeczytaj przed startem
- `CLAUDE.md` — reguła 1 (migracje), 3 (warstwa danych); `docs/03-conventions.md`; `docs/02-data-model.md`
- `src/app/api/inquiries/route.ts` — po insercie wysyła `InquiryRequestAnglerEmail` (`src/emails/inquiry-request-angler.tsx`)
- `src/app/admin/inquiries/InquiriesClient.tsx:120–150` — istniejące helpery „Xd ago", `last_contact_at ?? created_at`, flaga <24 h
- `src/app/admin/inquiries/[id]/StatusChanger.tsx` i `page.tsx:496` — gdzie `lost_reason` jest ustawiany i wyświetlany
- `src/lib/supabase/database.types.ts` — `inquiries.assigned_at`, `guide_offer_eta`, `offer_sent_at`, `external_offer_sent`, `next_action`, `last_contact_at`
- `src/app/api/cron/sync-google-ads/route.ts` + `vercel.json` — wzorzec crona (uwaga: FA-0.03 — GET)
- `docs/tasks/FA-1.03.md` — `inquiry_events` przyjdzie później; **nie** buduj tu własnego logu zdarzeń

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Klient po wysłaniu formularza dostaje w auto-mailu **datę**, do której dostanie konkretną
odpowiedź (48 h, dni robocze). Admin widzi na liście, ile godzin minęło od zapytania bez
oferty, czerwono powyżej 48 h. Raz dziennie przychodzi mail z listą zapytań po terminie.
Powód przegranej wybiera się z listy, więc lejek da się policzyć jednym SELECT-em.

## Zakres
- [ ] **Odczyt bieżącego stanu** (dane, produkcja, SELECT — wykonuje tj):
      ```sql
      select lost_reason, count(*) from inquiries where status='lost' group by 1 order by 2 desc;
      select percentile_cont(0.5) within group (order by extract(epoch from (assigned_at - created_at))/86400) as median_days_to_assign
      from inquiries where assigned_at is not null;
      ```
      Pierwsze zapytanie decyduje, czy lista wartości niżej pokrywa dane; drugie to liczba bazowa do raportu.
- [ ] Migracja: `inquiries.lost_reason_code text check (lost_reason_code in ('client_silent','no_guide','guide_slow','price','changed_plans','went_elsewhere','other'))`
      obok istniejącego `lost_reason` (wolny tekst zostaje jako komentarz). **Bez backfillu** w tym zadaniu —
      klasyfikacja historyczna to osobna decyzja (plik `fa_inquiries_sklasyfikowane.csv` z 5 IX jako punkt wyjścia).
- [ ] `StatusChanger`: przy `lost` wymagany `lost_reason_code` z listy + opcjonalny komentarz; zapis obu.
- [ ] Auto-mail do klienta: jedno zdanie z datą „We will come back to you with availability and a price by **{date}**"
      — `created_at + 2 dni robocze` (pon–pt, bez świąt; strefa Europe/Warsaw). Tekst — patrz STOP.
- [ ] Lista w adminie: kolumna „bez oferty od" = godziny od `created_at` dla wierszy bez `offer_sent_at`
      i `external_offer_sent=false` i statusu spoza {`lost`,`cancelled`,`deposit_paid`,`completed`};
      czerwono > 48 h, pomarańczowo > 24 h. Sortowanie po tej kolumnie. Bez nowych tabel.
- [ ] `GET /api/cron/offer-sla` (`CRON_SECRET`, wzorzec z FA-0.03): raz dziennie 07:00 Europe/Warsaw mail do `OWNER_EMAIL`
      z listą zapytań > 48 h bez oferty (nazwisko, kraj, godziny, link do admina). Pusta lista → brak maila.
- [ ] `vercel.json`: wpis crona. Regeneracja typów.

## Gotowe, gdy
- [ ] **Czerwony dowód**: `UPDATE inquiries SET lost_reason_code='vibes'` → błąd CHECK, wklejony.
- [ ] `StatusChanger` nie pozwala zapisać `lost` bez kodu — zrzut walidacji w raporcie; zapis z kodem → SELECT pokazuje `lost_reason_code`.
- [ ] Test jednostkowy funkcji „+2 dni robocze": piątek 15:00 → wtorek; sobota → środa; środa → piątek.
- [ ] Lokalnie: submit widgetu → auto-mail (podgląd z Resend test / render komponentu) zawiera datę zgodną z testem wyżej — zrzut w raporcie.
- [ ] Lista w adminie: wiersz starszy niż 48 h bez oferty ma czerwony znacznik; wiersz z `offer_sent_at` nie ma kolumny — zrzut ekranu.
- [ ] `curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/offer-sla` → `200` i JSON `{overdue: N}`; bez nagłówka → `401` (czerwony dowód).
- [ ] `supabase db diff --local` → `No schema changes found`; typy zregenerowane.
- [ ] `pnpm typecheck && pnpm test -- --run && pnpm build` zielone; `pnpm lint` zero nowych błędów vs `main`.
- [ ] Status `todo → review` tu i w `INDEX.md`, w tym samym PR.

## Poza zakresem
- Automatyczne przypisywanie przewodnika, przypomnienia do przewodników, WhatsApp — nie tutaj.
- Backfill `lost_reason_code` dla 56 historycznych — osobna decyzja tj.
- `inquiry_events` / oś czasu — FA-1.03.
- Zmiana treści auto-maila poza jednym zdaniem z datą.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- `db push` na produkcję — **STOP**, treść migracji + `db diff`, zgoda tj, wykonuje tj.
- Jeśli odczyt `lost_reason` pokaże kategorię, której nie ma na liście CHECK-a i nie mieści się w `other` — **STOP**, nie rozszerzaj listy sam.
- Zdanie w auto-mailu to obietnica wobec klienta — **treść zatwierdza tj** przed merge'em; agent proponuje, nie decyduje.
- `OWNER_EMAIL` — jeśli nie ma w `env.ts`, dodaj do schematu zod i **zatrzymaj się** przed ustawianiem wartości na Vercelu.

## Weryfikacja
```
supabase migration up --local && supabase db diff --local
psql … -c "update inquiries set lost_reason_code='vibes' where id=(select id from inquiries limit 1);"   # ERROR check
pnpm test -- --run src/lib/business-days.test.ts
curl -s -o /dev/null -w "%{http_code}\n" localhost:3000/api/cron/offer-sla                                 # 401
curl -s -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/offer-sla                          # {"overdue":N}
supabase gen types typescript --local > src/lib/supabase/database.types.ts
pnpm typecheck && pnpm lint && pnpm test -- --run && pnpm build
```

## Notatki z realizacji

### Zrobione

1. **Migracja** `20260909134748_inquiries_lost_reason_code.sql` — dodaje `lost_reason_code text CHECK (lost_reason_code in ('client_silent','no_guide','guide_slow','price','changed_plans','went_elsewhere','other'))`. Zastosowana lokalnie przez `supabase db reset` (wykonany ręcznie przez tj — agent-guard blokuje to polecenie tak jak operacje prod, patrz `docs/deferred-tasks.md`). **Nie** zaaplikowana na produkcji — STOP gate, zatwierdza i wykonuje tj.

2. **`src/lib/business-days.ts`** — nowy moduł `addBusinessDays(date, n, tz)`. Algorytm: wyciąga lokalną datę przez `Intl.DateTimeFormat` (DST-safe), snapuje weekendy do następnego poniedziałku, potem przesuwa dokładnie `n` dni roboczych. Całe dalsze liczenie w UTC — odporne na DST. `formatBusinessDay(d)` zwraca `"Tuesday, 15 September"`.

3. **`src/lib/business-days.test.ts`** — 4 przypadki: Pt 15:00 CEST → Wt; Sb → Śr; Śr → Pt; niedziela ostatnia-października (DST) → Śr. Wszystkie zielone.

4. **Auto-mail do klienta** (`src/emails/inquiry-received-angler.tsx` + `src/app/api/inquiries/route.ts`) — prop `replyByDate: string` (format `"Tuesday, 15 September"`); zdanie body zastąpione na `We'll come back to you with availability and a price by <strong>{replyByDate}</strong>.`; badge `We'll be in touch within 24 hours.` → `We'll be in touch by {replyByDate}.`. **Treść czeka na zatwierdzenie tj — STOP otwarty.**

5. **`updateInquiryStatus`** (`src/actions/inquiries.ts`) — nowa sygnatura `(inquiryId, status, lostReasonCode?, lostReason?)`. Walidacja server-side: status='lost' bez kodu → `{ success: false, error: 'A loss reason is required when marking as lost.' }`. Przy 'lost' zapisuje `lost_reason_code`; przy innych statusach zeruje do `null`.

6. **`StatusChanger.tsx`** — kompletny rewrite. Select wymagany (7 opcji); przycisk Confirm disabled do czasu wyboru. Wolny tekst `lostComment` opcjonalny. Walidacja client-side + wywołanie `updateInquiryStatus(id, 'lost', lostReasonCode, lostComment || null)`.

7. **Lista w adminie** (`InquiriesClient.tsx`) — `noOfferSinceHours(row)`: null jeśli `offer_sent_at != null`, `external_offer_sent=true`, lub status w `{lost,cancelled,deposit_paid,completed}`; inaczej godziny od `created_at`. `SlaBadge`: `{hours}h bez oferty` orange >24 h, red >48 h, niewidoczny <24 h. Sortowanie „⏱ Bez oferty od" przybliżone przez `sortSla` toggle. `offer_sent_at` dodano do select query w `page.tsx`.

8. **`GET /api/cron/offer-sla`** (`src/app/api/cron/offer-sla/route.ts`) — Bearer `CRON_SECRET` (401 bez); query `offer_sent_at IS NULL + external_offer_sent=false + status NOT IN (lost,cancelled,deposit_paid,completed) + created_at < NOW()-48h`. Zero wyników → `{overdue:0}`. `OWNER_EMAIL` nieustawiony → `{overdue:N, mailed:false}`. Gdy N>0 i `OWNER_EMAIL` ustawiony → digest HTML (name | country | **status** | hours | admin link) przez Resend REST fetch; reply colors orange >72h red. `POST = GET` dla kompatybilności.

9. **`vercel.json`** — `"0 5 * * *"` UTC = 07:00 CEST / 06:00 CET. Cron Vercel nie ma DST — schedules na stałe w UTC.

10. **`src/lib/env.ts`** — `OWNER_EMAIL: z.string().email().optional()` (STOP: nie ustawiać na Vercelu bez zgody tj).

11. **`src/lib/supabase/database.types.ts`** — `lost_reason_code` w Row/Insert/Update. Pierwotnie dopisane ręcznie, bo w tamtym momencie Docker/OrbStack był padnięty i `supabase gen types --local` nie startował. Po podniesieniu Dockera plik został **zregenerowany generatorem** i wynik jest bajt w bajt identyczny z wersją ręczną — to regeneracja weryfikuje typy, nie `db diff --local` (ten porównuje bazę z migracjami i pliku typów w ogóle nie widzi).

12. **`docs/deferred-tasks.md`** — wpis FA-0.16: agent-guard blokuje `db reset` i `migration repair --local` tak samo jak operacje prod; brak odblokowania per polecenie; zadanie S: naprawić wzorce i komunikat.

13. **`declineOffer` (`src/actions/inquiries.ts:1527`)** — poprawka po review: klient odrzucający ofertę na `/offers/[token]` ustawiał `status='lost'` **bez** `lost_reason_code`, omijając walidację z `updateInquiryStatus`. Teraz zapisuje `lost_reason_code: 'went_elsewhere'` obok wolnego tekstu. Grep potwierdził, że to jedyne dwa miejsca zapisujące `status='lost'` w całym `src/` — nie ma trzeciej ścieżki.

14. **`src/actions/__tests__/lostReasonCode.test.ts`** — 4 nowe testy jednostkowe: `lost` bez kodu → odrzucone; `lost` z pustym stringiem → odrzucone; `lost` z kodem → zapis obu pól; przejście na status inny niż `lost` → `lost_reason_code = null`.

15. **Definicja „bez oferty" (FA-0.19)** — zapytanie liczy się jako „bez oferty" jeśli `offer_sent_at IS NULL` i `external_offer_sent = false`. Od FA-0.19 `saveInternalDeal` ustawia `external_offer_sent = true` przy zapisie deal total lub prowizji — wpisanie kwoty w hubie prowizji automatycznie wyklucza sprawę z alarmu SLA.

### Dowody (wszystkie wykonane 10 IX 2026, lokalny stack)

**`supabase migration list --local` — 5 wersji, lokalne = zdalne:**
```
   Local          | Remote         | Time (UTC)
  ----------------|----------------|---------------------
   20260904165037 | 20260904165037 | 2026-09-04 16:50:37
   20260904165038 | 20260904165038 | 2026-09-04 16:50:38
   20260904210532 | 20260904210532 | 2026-09-04 21:05:32
   20260909131403 | 20260909131403 | 2026-09-09 13:14:03
   20260909134748 | 20260909134748 | 2026-09-09 13:47:48
```

**`supabase db diff --local` (bez szumu PostGIS `WARNING (01007)`):**
```
Applying migration 20260904165037_baseline_prod.sql...
Applying migration 20260904165038_fix_nz_species_casing.sql...
Applying migration 20260904210532_inquiries_source_utm.sql...
Applying migration 20260909131403_web_events.sql...
Applying migration 20260909134748_inquiries_lost_reason_code.sql...
Diffing schemas...
No schema changes found
```

**Czerwony dowód CHECK — `lost_reason_code='vibes'`:**
```
ERROR:  new row for relation "inquiries" violates check constraint "inquiries_lost_reason_code_check"
DETAIL:  Failing row contains (11111111-…, …, vibes).
```

**Zielony dowód — wartość z listy przechodzi:**
```
        step         | status | lost_reason_code |       lost_reason
---------------------+--------+------------------+-------------------------
 VALID CODE ACCEPTED | lost   | price            | Too expensive for group
```

**Walidacja `updateInquiryStatus` — 4/4 zielone** (`src/actions/__tests__/lostReasonCode.test.ts`):
```
 ✓ rejects status=lost with no reason code
 ✓ rejects status=lost with an empty-string reason code
 ✓ accepts status=lost with a reason code and writes both fields
 ✓ clears lost_reason_code when moving to a non-lost status
```

**`declineOffer` po poprawce — realne wywołanie na lokalnej bazie, potem SELECT:**
```
[declineOffer] Inquiry 22222222-… declined by angler
declineOffer result: {"success":true}
SELECT after declineOffer: {
  "id": "22222222-2222-2222-2222-222222222222",
  "status": "lost",
  "lost_reason_code": "went_elsewhere",
  "lost_reason": "Went with another operator"
}
```

**Niezależny `psql` SELECT — obie ścieżki zapisu:**
```
                  id                  |  angler_name   | status | lost_reason_code |        lost_reason
--------------------------------------+----------------+--------+------------------+----------------------------
 22222222-2222-2222-2222-222222222222 | Decline Tester | lost   | went_elsewhere   | Went with another operator
 11111111-1111-1111-1111-111111111111 | Test Angler    | lost   | price            | Too expensive for group
```

**Render maila — data zgodna z testem jednostkowym** (piątek 2026-09-11 15:00 CEST → wtorek):
```
computed replyByDate = Tuesday, 15 September
MATCH: We'll come back to you with availability and a price by Tuesday, 15 September .
MATCH: We'll be in touch by Tuesday, 15 September .
contains "24 hours"? → false
```

**Cron — auth (serwer podniesiony na lokalnym Supabase, nie na projekcie testowym):**
```
=== NO HEADER ===        HTTP 401   {"error":"Unauthorized"}
=== WRONG SECRET ===     HTTP 401
=== CORRECT SECRET ===   HTTP 200   {"overdue":0}
```

**Cron — logika zapytania. Zaseedowane 6 wierszy pokrywających każdą gałąź wykluczenia:**
```
  angler_name   |   status   | external_offer_sent | age_h | has_offer
----------------+------------+---------------------+-------+-----------
 Decline Tester | lost       | f                   |    80 | f    ← status wykluczony
 Test Angler    | lost       | f                   |    72 | f    ← status wykluczony
 Overdue Ola    | pending    | f                   |    72 | f    ← LICZY SIĘ
 Offered Olaf   | offer_sent | f                   |    72 | t    ← ma offer_sent_at
 External Eva   | offer_sent | t                   |    72 | f    ← external_offer_sent
 Fresh Filip    | pending    | f                   |    10 | f    ← młodszy niż 48 h
```
```
HTTP 200   {"overdue":1,"mailed":false}
```
Liczy dokładnie jeden wiersz (Overdue Ola); `mailed:false`, bo `OWNER_EMAIL` nieustawiony — udokumentowana ścieżka graceful.

**Lista w adminie — Playwright, zalogowany admin** (`docs/proofs/fa016-admin-sla-{lead,guide}.png`):

Zakładka *Lead* — wiersz po terminie ma czerwony znacznik, świeży nie ma:
```
  Overdue Ola    "Overdue Ola | No contact | … | Pending | 72h no offer | 3d ago"
  Fresh Filip    "Fresh Filip | New | … | Pending |  | today"        ← brak znacznika
```
Zakładka *Guide* — wiersze z ofertą nie mają znacznika mimo 72 h:
```
  Offered Olaf   "Offered Olaf | … | Offer Sent |  | 3d ago"          ← ma offer_sent_at
  External Eva   "External Eva | … | Offer Sent |  | 3d ago"          ← external_offer_sent=true
  liczba znaczników "no offer" na tej zakładce: 0
```

**`pnpm lint` — `main` vs gałąź, oba przebiegi pełne:**
```
main:                  ✖ 96 problems (40 errors, 56 warnings)
feat/offer-sla-48h:    ✖ 96 problems (40 errors, 56 warnings)
```
Identycznie — zero nowych błędów. Pliki FA-0.16 osobno: 0 errors (2 ostrzeżenia `labelCell`/`valueCell` w `inquiry-received-angler.tsx` są sprzed tego zadania, w nietkniętych liniach).

**Regeneracja typów — `supabase gen types typescript --local`** (po podniesieniu Dockera):
```
$ supabase gen types typescript --local > src/lib/supabase/database.types.ts
$ git diff --stat src/lib/supabase/database.types.ts
(pusto — plik bez zmian)

sha256 wygenerowany : d9e1a2d8654b2cecffb3d901efdc3eb87925f64a805f9458bb20d4bde8914d12
sha256 zacommitowany: d9e1a2d8654b2cecffb3d901efdc3eb87925f64a805f9458bb20d4bde8914d12
lost_reason_code w pliku: 3 wystąpienia (Row / Insert / Update)
```
Pusty diff = ręczny wpis był zgodny z generatorem. To jest dowód na typy; wcześniejsze powołanie się w tym miejscu na `db diff --local` było błędne — `db diff` porównuje bazę z migracjami i nie czyta `database.types.ts`.

**`pnpm typecheck`** — 0 błędów. **`pnpm test -- --run`** — 57/57 zielonych. **`pnpm build`** — exit 0.

### Smoke prod 10 IX

Migracja zaaplikowana na produkcji (`uwxrstbplaoxfghrchcy`) przez `apply_migration` po „go" od tj. Odczyty potwierdzające, wykonane przez agenta zaraz po zapisie:

`list_migrations` — nowy wpis na końcu, nazwa bez prefiksu z datą:
```
20260910111336 | inquiries_lost_reason_code
```

Kolumna, brak backfillu (jedno zapytanie, żeby liczby pochodziły z tego samego momentu):
```
column_exists | rows_with_code | rows_total
--------------+----------------+-----------
            1 |              0 |         91
```
91 wierszy na produkcji, wszystkie `lost_reason_code IS NULL`.

Definicja CHECK — 7 wartości, zgodna z migracją:
```sql
CHECK ((lost_reason_code = ANY (ARRAY[
  'client_silent'::text, 'no_guide'::text, 'guide_slow'::text, 'price'::text,
  'changed_plans'::text, 'went_elsewhere'::text, 'other'::text])))
```

**Cron na produkcji — pełne przejście `cron → query → mail`.** `OWNER_EMAIL` ustawione przez tj po merge; digest dotarł. Potwierdzone przez tj 10 IX 2026.

Curl na produkcji (`www.fjordanglers.com`, 10 IX 2026, wykonał tj):
```
bez nagłówka:          401
z Bearer CRON_SECRET:  {"overdue":10,"mailed":true}
```
`mailed:true` to potwierdzenie całej ścieżki, nie samego zapytania: endpoint policzył zaległe zapytania, złożył digest i oddał go Resendowi. Digest dotarł na `OWNER_EMAIL` — potwierdzone przez tj.

Dziesięć zaległych zapytań na starcie to stan zastany, nie regres — dokładnie ta liczba, której licznik miał nie przepuszczać niezauważenie.

**Uwaga do przyszłych dowodów:** goły `https://fjordanglers.com/...` zwraca **307** (redirect na `www`). Curl bez `-L` na golej domenie nie dotknie route'u i nie sprawdzi niczego — 307 to ani 401, ani 200, a przy `-o /dev/null -w '%{http_code}'` łatwo wziąć go za wynik testu. W dowodach i dokumentacji używaj `www.fjordanglers.com` albo `curl -L`.

### Nie zrobione

Wszystkie pozycje z tej sekcji zostały domknięte po review — zostawione dla historii:

- ~~Migracja na prod~~ — zaaplikowana 10 IX przez `apply_migration` po „go" od tj, wersja `20260910111336`. Patrz „Smoke prod 10 IX".
- ~~`OWNER_EMAIL` na Vercelu~~ — ustawione przez tj po merge; potwierdzone dotarciem digestu.
- ~~Regeneracja typów~~ — zrobiona, patrz „Dowody".
- Treść maila do klienta — tj zatwierdza osobno; agent nie zmieniał jej po review.

### Zauważone, odłożone

- Lokalny Auth (`/auth/v1/admin/users`) odrzuca zarówno legacy `SERVICE_ROLE_KEY`, jak i nowy `SECRET_KEY` z `bad_jwt: signing method HS256 is invalid` — użytkownika testowego trzeba było wstawić bezpośrednio do `auth.users` przez SQL. Nie dotyczy FA-0.16, ale każdy przyszły e2e z logowaniem na to trafi.
- `agent-guard.sh` / `FA_ALLOW_PROD=1` — patrz `docs/deferred-tasks.md` FA-0.16 (i FA-1.01 wcześniej).

### Decyzje

- Algorytm business days: sobota → snap do poniedziałku → +2 = środa (nie sobota+2=poniedziałek). Decyzja agenta, zgodna z kryterium „sobota → środa" z sekcji „Gotowe, gdy" — nie zatwierdzenie tj.
- Email wording: oba miejsca (body + badge) zmienione, bo oba obiecywały „within 24 hours". **Treść czeka na zatwierdzenie tj — STOP otwarty.**
- Digest email: inline HTML przez Resend REST (nie React email template) — cron route samowystarczalny.
- `vercel.json` `"0 5 * * *"`: DST caveat zanotowany w komentarzu modułu i w notatce powyżej.

