---
id: FA-1.74
title: Oferta edytowalna — zmiana nazwy i ceny po utworzeniu, kilka pozycji w ofercie, oferta bez odpowiedzi w wątku
stage: 1
status: done
difficulty: M
model: sonnet
model_approved:
effort: high
agent: fa-core
branch: feat/fa-1.74-editable-offer
pr: 167
depends_on: []
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 5
owner: tj
---

# FA-1.74 — Oferta edytowalna po utworzeniu

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md`
- `src/app/admin/inquiries/[id]/NextStepCard.tsx` — karta „Next step” (formularz „Create guide offer”, etapy `no_offer` / `present` / `decision` / `deposit`)
- `src/app/admin/inquiries/[id]/page.tsx` — skąd karta bierze ofertę (najnowszy wiersz `offers` dla zapytania) i `latestInboundMsgId`
- `src/actions/messages.ts` — `markAsGuideOffer` (RPC `create_offer_with_options`), `markClientAccepted`
- `supabase/migrations/20260917104506_add_offers.sql` — `offers`, `offer_options`, triggery „oferta ma ≥1 pozycję” (insert i delete, DEFERRABLE)
- `supabase/migrations/20260917140000_create_offer_with_options_rpc.sql` — czy `p_source_message_id` przyjmuje NULL
- `src/lib/events/types.ts` — lista typów zdarzeń
- `src/lib/inquiries/deposit.ts` — podpowiedź depozytu z ceny zaakceptowanej pozycji
- `docs/01-architecture.md` §3–4 — oferty i zdarzenia

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Dziś oferta tworzy się raz (jedna pozycja: nazwa, cena, waluta) i potem jest tylko do odczytu, a „Create guide offer” działa dopiero po odpowiedzi w wątku. W praktyce cena zmienia się często, guide podaje ją czasem poza wątkiem (WhatsApp, telefon), a bywa kilka wariantów (3 i 5 dni). Po zadaniu admin tworzy ofertę z dowolną liczbą pozycji także bez odpowiedzi w wątku i zmienia nazwę, cenę i walutę każdej pozycji (oraz dodaje/usuwa pozycje) na każdym etapie przed płatnością — bez cofania etapu. Każda zmiana zostaje w historii zapytania (stara i nowa wartość).

## Decyzje tj (2026-10-27)
- D1 (a) **Edycja w miejscu**: zmiana oferty nie tworzy nowej wersji i nie cofa etapu (draft / presented / accepted zostaje). Historia = zdarzenie z wartościami przed i po.
- D2.1 **Oferta bez odpowiedzi w wątku**: „Create guide offer” dostępne zawsze w etapie `no_offer`; wiadomość źródłowa opcjonalna (gdy jest odpowiedź w wątku — nadal się podpina).
- D2.5 **Kilka pozycji w ofercie** — w formularzu tworzenia i edycji („Add option” / usuń pozycję; minimum jedna).

## Zakres
- [ ] Odczyt stanu: `NextStepCard.tsx` (etap `no_offer` i formularz), `markAsGuideOffer`, definicja RPC `create_offer_with_options` (czy przyjmuje NULL jako wiadomość źródłową), triggery minimum jednej pozycji — wkleić fragmenty.
- [ ] Formularz „Create guide offer”: wiele pozycji (nazwa, cena, waluta każda), przycisk aktywny bez wiadomości w wątku; podpowiedź „unlocks after the first reply” usunięta.
- [ ] `markAsGuideOffer`: działa bez wiadomości źródłowej (wejście z karty bez `messageId` → oferta z `source_message_id = null`, `inquiryId` podany wprost); zdarzenie `guide.offer_received` emitowane jak dziś (z `messageId` albo null).
- [ ] Nowa akcja serwerowa edycji oferty (np. `updateOfferOptions(offerId, options)`): zmiana nazwy / ceny / waluty istniejących pozycji, dodanie nowych, usunięcie pozycji — bez zejścia poniżej jednej pozycji; dozwolona dla statusów oferty `draft`, `presented`, `accepted`; odrzucona dla `declined` / `superseded` i gdy zapytanie jest `paid` lub dalej. Usunięcie zaakceptowanej pozycji — odrzucone z czytelnym błędem (najpierw zmiana akceptacji, to FA-1.76).
- [ ] Bez migracji. Kolejność zapisów tak, by triggery DEFERRABLE nie odrzuciły pośredniego stanu (najpierw dodanie/zmiana, usunięcie na końcu). **Jeśli bez funkcji w bazie nie da się tego zrobić bezpiecznie (np. zapis częściowy przy błędzie) — STOP i opisz problem, nie pisz migracji.**
- [ ] Nowy typ zdarzenia `offer.updated` w `src/lib/events/types.ts`; payload: `offer_id` + lista pozycji przed i po (`id`, `label`, `price_cents`, `currency`).
- [ ] Karta: przycisk „Edit offer” w etapach `present`, `decision`, `deposit` → ten sam formularz z wartościami bieżącymi; po zapisie etap bez zmian.
- [ ] Etap `deposit`: gdy zmieniła się cena zaakceptowanej pozycji, a kwota depozytu jest już zapisana — ostrzeżenie na karcie („Deposit was set from the old price — check the amount”) i podpowiedź `DEPOSIT_PERCENT` (20%) liczona z nowej ceny.
- [ ] Testy: akcja edycji (zmiana ceny, dodanie, usunięcie, odmowa usunięcia ostatniej i zaakceptowanej pozycji, odmowa po `paid`), oferta bez wiadomości źródłowej, karta (formularz wielu pozycji, „Edit offer”).

## Gotowe, gdy
- [ ] Oferta z dwiema pozycjami tworzy się w zapytaniu bez żadnej wiadomości przychodzącej — test akcji + test karty (przycisk aktywny przy `latestInboundMsgId = null`).
- [ ] Zmiana ceny pozycji w ofercie `presented` i `accepted` zapisuje nową cenę, nie zmienia statusu oferty ani zapytania i dodaje jedno zdarzenie `offer.updated` z ceną przed i po — test akcji z odczytem `offer_options`, `offers.status`, `inquiries.status`, `inquiry_events`.
- [ ] Usunięcie ostatniej pozycji, usunięcie pozycji zaakceptowanej i edycja oferty przy zapytaniu `paid` są odrzucone z błędem i bez zmian w bazie — **red proof**: wklejone wyniki trzech testów na celowo złych wejściach.
- [ ] Ostrzeżenie o depozycie od starej ceny widoczne w etapie `deposit` po zmianie ceny zaakceptowanej pozycji — test karty.
- [ ] Zrzuty (desktop): formularz z dwiema pozycjami, karta „present” z „Edit offer”, ostrzeżenie w „deposit”.
- [ ] CI zielone na head PR (`check`, `knip`, `db`, `secrets`) — lista wklejona.

## Poza zakresem
- Pominięcie „Mark as presented”, cofanie kroków, zmiana zaakceptowanej pozycji, „Notify guide” bez wiadomości, przywrócenie z lost — FA-1.76.
- Nazwa i opis payment linku — FA-1.77.
- Automatyczna zmiana kwoty depozytu lub linku po zmianie ceny — tylko ostrzeżenie.
- Wersjonowanie ofert (`superseded`) — odrzucone w D1.
- Strona oferty dla klienta (`offers/[token]`).
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Jakakolwiek migracja / funkcja w bazie — STOP przed napisaniem (zadanie zakłada brak migracji).

## Weryfikacja
```
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

## Notatki z realizacji

**Decyzje tj 2026-10-27 (po odczycie stanu, przed implementacją):**
- **D-A = A** — zapis edycji bez funkcji w bazie: trzy zapisy (zmiana/dodanie pozycji, usunięcie pozycji, zdarzenie) + cofnięcie przy błędzie. Warunki tj: zdarzenie `offer.updated` zapisywane dopiero po udanych wszystkich zapisach pozycji; gdy którykolwiek zapis się nie uda — cofnięcie i błąd. Test wymuszający błąd drugiego zapisu pokazuje ofertę w stanie wyjściowym i brak `offer.updated` — wklejony jako red proof.
- **D-B = A** — `offer.updated` liczy się jako ręczne dotknięcie (M11), zgodnie z `REBUILD_PLAN.md` §M11 („edycja oferty”); Załącznik C poprawiony. Niespójność (`offer.presented` / `offer.accepted` nieliczone) → `docs/deferred-tasks.md`, bez zmiany w tym zadaniu.
- **D-C = A** — dozwolone waluty pozycji: EUR, USD, ISK, NZD (ta sama lista co depozyt); NZD dodane do formularza.
- **D-D = A** — edycja odrzucona także dla zapytań `lost` / `cancelled` (oprócz `paid` / `handed_over` / `completed`).
- Podpowiedź depozytu = `DEPOSIT_PERCENT` (20%), nie 30% — linia w Zakresie poprawiona zgodnie z decyzją tj z 2026-10-27.
- Równoległa edycja tej samej oferty przez dwóch adminów (drugi zapis może usunąć pozycję dodaną przez pierwszego) → `docs/deferred-tasks.md`.
- **2026-10-27, tj: preflight = A** — `scripts/dev-preflight.sh` nie istnieje (to produkt FA-1.67, `todo`; reguła w prompcie zastosowana za wcześnie). Zamiast skryptu: trzy ręczne sprawdzenia (docker odpowiada w 10 s, brak obcych `supabase_*`, wolny dysk) + dowód wiersza seed (`admin@seed.test`) przez ten sam URL bazy co dev server, wklejone przed pierwszym krokiem w przeglądarce. `next dev` tylko z env z `supabase status -o env` + `RESEND_DEV_FAKE=1`, `EXPERIENCE_V2_ENABLED=true`, atrapy Stripe z `.env.test`; nigdy `.env.local`. Walk tylko ekranów zapytania w adminie potrzebnych do zrzutów — bez wysyłki z Conversation, bez formularza publicznego, bez payment linków. Po walku `next dev` zatrzymany; kontenery Seaclouds zostają zatrzymane i wypisane w raporcie.
- **2026-10-27 — accepted by tj on 9b4e217 (PR #167):** all six criteria proven (action + card tests, three refusal red proofs + rollback tests on the in-memory fake, screenshots 01–08, CI check/db/knip/secrets green). Known limits: rollback proven only on the fake DB; accepted stage in the walk reached via SQL fixture (Mark as presented needs a message until FA-1.76).
