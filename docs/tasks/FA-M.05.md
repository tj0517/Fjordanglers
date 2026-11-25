---
id: FA-M.05
title: Wysyłka zlecenia z karty zapytania — osobisty WhatsApp tj przez wa.me + oś czasu zlecenia, w miejsce starego przypisania
stage: M
status: done
difficulty: M
model: opus
model_approved: tj 2026-11-23
effort: high
agent: fa-admin
branch: feat/fa-m.05-send-guide-request
pr: 211
depends_on: [FA-M.03, FA-M.04]
blocked_by_questions: []
touches_db: true
touches_prod: true
estimate_h: 8
owner: tj
---

# FA-M.05 — Wysyłka zlecenia do przewodnika

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md`
- `docs/tasks/FA-M.03.md`, `docs/tasks/FA-M.04.md` — rekord zlecenia, token, strona `/r/[token]`
- `src/lib/guide-requests/requests.ts` — `createGuideRequest` (token zwracany raz), `withdrawGuideRequest`, odpowiedź (`note`, `alt_dates`)
- `supabase/migrations/20261117000000_add_guide_requests.sql` — `create_guide_request` ustawia `inquiries.assigned_guide_id` i emituje `guide.request_sent`; kanał `whatsapp` dozwolony
- `src/lib/guide-contacts.ts` + `supabase/migrations/20261004000000_guide_contacts.sql` — jedyne źródło numeru WhatsApp przewodnika (`guide_contacts.phone_e164`, tylko service_role)
- `src/actions/inquiries.ts` — stare `assignGuideToInquiry` (e-mail do przewodnika), `assignGuideSilently`, `unassignGuide`, `setExternalOffer`
- `src/app/admin/inquiries/[id]/GuideAttachmentTab.tsx`, `src/app/admin/inquiries/[id]/page.tsx`, `src/app/admin/inquiries/InquiriesClient.tsx`
- `src/app/admin/guides/[id]/edit/page.tsx` — miejsce na pole numeru WhatsApp
- `docs/deferred-tasks.md` — trzy wiersze z FA-M.03 (badge/filtr `other_dates`, daty i notatka przewodnika, stare assign/unassign)
- `docs/design/fa-m-guide-app/README.md` + `Push.dc.html` — zatwierdzone sformułowanie wiadomości
- `docs/04-open-questions.md` O-51 — zastąpione decyzją 2026-11-23

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Admin jednym przyciskiem na karcie zapytania wysyła zlecenie wybranemu przewodnikowi: tworzy się rekord zlecenia (FA-M.03), a tj dostaje gotową wiadomość WhatsApp z linkiem do zlecenia, którą wysyła ze swojego telefonu (link `wa.me`). Na karcie widać oś czasu zlecenia — wysłano, otwarto, odpowiedź (akceptacja / odmowa z powodem / inne daty z datami i notatką przewodnika) — i historię wcześniejszych zleceń po zmianie przewodnika. „Send request” / „Withdraw” w pełni zastępują stare assign/unassign, więc każde przypięcie przewodnika zostawia rekord zlecenia i zdarzenie. Admin zapisuje numer WhatsApp przewodnika na stronie edycji przewodnika.

## Zakres
- [ ] Odczyt stanu: `GuideAttachmentTab.tsx` i wszyscy wołający `assignGuideToInquiry` / `assignGuideSilently` / `unassignGuide`; wszystko, co czyta `inquiries.assigned_guide_id` na ścieżce zapytanie → oferta → zaliczka; `guide_contacts` lokalnie; funkcje zleceń w `requests.ts`. Krótka mapa tego, co czyta przypisanie.
- [ ] Numer WhatsApp przewodnika: pole na `/admin/guides/[id]/edit`, akcja serwera za `requireAdmin()`, walidacja E.164 (`+` i 8–15 cyfr), upsert do `guide_contacts` przez warstwę danych; pusta wartość czyści. Na stronie przewodnika tylko do odczytu.
- [ ] Akcja „Send request” (`requireAdmin()`): brak numeru → czytelny błąd, bez zlecenia; inaczej `createGuideRequest(channel 'whatsapp')` i zwrot URL-a wa.me + gołego linku. Treść po angielsku wg `Push.dc.html` (imię przewodnika, liczba osób / rejon, daty, link); bez budżetu klienta.
- [ ] „Withdraw” przez `withdrawGuideRequest`.
- [ ] Karta zapytania: przycisk wysyłki przy przewodniku, potem „Open WhatsApp” + kopiowanie linku (pokazane raz); oś czasu zlecenia (wysłano / otwarto / odpowiedź z datami lub powodem / wycofano) i historia wcześniejszych zleceń; `other_dates` pokazuje daty i notatkę przewodnika.
- [ ] Lista zapytań: badge i filtr dla `guide_acceptance = 'other_dates'`.
- [ ] Zastąpienie starego assign/unassign: każda ścieżka UI, która przypinała lub odpinała przewodnika, idzie przez send/withdraw. **STOP** przed usunięciem starych akcji — mapa z pierwszego kroku i każde użycie bez odpowiednika send/withdraw, decyzja tj.
- [ ] Usunięcie starych akcji i ich martwego kodu UI/e-mail po zgodzie (reguła 9); wiersze z FA-M.03 w `docs/deferred-tasks.md` oznaczone jako rozwiązane przez FA-M.05.
- [ ] Testy (bez sieci: bez API WhatsApp, bez Resend).

## Gotowe, gdy
- [ ] Wysyłka przy zapisanym numerze tworzy dokładnie jedno zlecenie i jedno zdarzenie `guide.request_sent` (kanał `whatsapp`) i zwraca URL wa.me, którego numer to cyfry E.164 bez `+`, a zdekodowany tekst zawiera `/r/<token>` — **jak sprawdzić:** test akcji.
- [ ] Przewodnik bez numeru → błąd, zero zleceń, zero zdarzeń; pokazane na czerwono — **jak sprawdzić:** test akcji.
- [ ] Wywołanie send, withdraw i akcji numeru przez nie-admina jest odrzucone; pokazane na czerwono — **jak sprawdzić:** testy akcji.
- [ ] Pole numeru odrzuca wartość spoza E.164 i zapisuje poprawną w `guide_contacts` — **jak sprawdzić:** test akcji.
- [ ] Token występuje tylko w odpowiedzi akcji wysyłki: nie w bazie, logach, URL-u strony admina ani po przeładowaniu — **jak sprawdzić:** test + grep, że żadna ścieżka go nie zapisuje ani nie loguje.
- [ ] Oś czasu pokazuje znaczniki wysłano / otwarto / odpowiedź, `other_dates` z datami i notatką, oraz dwa zlecenia dla jednego zapytania (historia) — **jak sprawdzić:** test komponentu + zrzut na lokalnych danych utworzonych skryptem/testem (seed nie ma zleceń — opisać jak).
- [ ] Badge i filtr listy dla `other_dates` — **jak sprawdzić:** test komponentu/filtra + zrzut.
- [ ] Stare `assignGuideToInquiry`, `assignGuideSilently`, `unassignGuide` usunięte i nikt ich nie importuje — **jak sprawdzić:** pusty `grep` (dopiero po zgodzie przy STOP).
- [ ] Ścieżka oferty działa: lokalnie zapytanie z przewodnikiem przypiętym przez „Send request” może dostać ofertę i link do zaliczki jak dotąd — **jak sprawdzić:** dotychczasowe testy ofert zielone + zrzut kroku oferty z lokalnego przejścia.
- [ ] Pliki zadań, INDEX i O-51 zaktualizowane wg decyzji — **jak sprawdzić:** diff w PR.
- [ ] CI zielone na head (`check`, `knip`, `db`, `secrets`).

## Poza zakresem
- WhatsApp Business API / szablon Mety, jakakolwiek automatyczna wysyłka → po MVP.
- Logika ponaglenia i flaga „nie otworzył” → FA-M.06.
- Push → FA-M.12.
- Wysyłka do kilku przewodników naraz → po MVP.
- `guide_private.whatsapp` / `guide_private.phone` (stare, puste kolumny) — nie czytać, nie zapisywać; do deferred.
- Dzisiejsza wysyłka WhatsApp w `MessageComposer` / `src/actions/messages.ts` → bez zmian.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Przed usunięciem `assignGuideToInquiry`, `assignGuideSilently`, `unassignGuide`: mapa z pierwszego kroku + każde użycie bez odpowiednika send/withdraw (np. przewodnik przypięty tylko po to, by zapisać ofertę zewnętrzną lub dawną, `setExternalOffer`) → decyzja tj.
- Zadanie nie potrzebuje migracji; jeśli okaże się potrzebna — STOP.
- Żadnej prawdziwej wysyłki (WhatsApp, Resend) z dev/testów.

## Weryfikacja
```
pnpm test -- --run guide-requests send-guide-request guide-contacts GuideAttachmentTab InquiriesClient
pnpm test -- --run offers
grep -rn "assignGuideToInquiry\|assignGuideSilently\|unassignGuide" src        # pusto (po zgodzie przy STOP)
grep -rn "guide_private" src --include=*.ts --include=*.tsx | grep -v database.types   # pusto
```

## Notatki z realizacji
- **2026-11-10, tj (wf-plan):** O-51 → (a) szablon Mety ze zmienną URL; do zatwierdzenia — link kopiowany ręcznie z karty.
- **2026-11-23, tj — wariant A:** FA nie ma WhatsApp Business API. Zlecenia wysyła tj ze swojego osobistego WhatsAppa przez link `https://wa.me/<cyfry>?text=<zakodowana treść>`. Bez szablonu Mety, bez logiki okna 24 h, bez wysyłki przez API w tym zadaniu. O-51 zastąpione → (c). Zależność od FA-M.11 usunięta (`depends_on: [FA-M.03, FA-M.04]`).
- **2026-11-23, tj — D1 (a):** „Send request” tworzy zlecenie (zdarzenie przy tworzeniu); karta pokazuje wtedy „Open WhatsApp” (gotowa wiadomość z linkiem `/r/<token>`) i link do skopiowania. Bez automatycznego otwierania okna. Token pokazany tylko w tej chwili, nigdy zapisany ani pokazany ponownie.
- **2026-11-23, tj — D2 (a):** FA-M.06 = flaga admina „przewodnik nie otworzył po 12/24 h” + przycisk WhatsApp do ręcznego ponaglenia; push, jeśli przewodnik ma push (FA-M.12). FA-M.06 zależy od FA-M.12.
- **2026-11-23, tj — D3 (a):** FA-M.05 i FA-M.12 idą równolegle; FA-M.12 zależy tylko od FA-M.08 i FA-M.11 (klucze VAPID).
- **2026-11-23, tj — D4 (a):** pole numeru WhatsApp na stronie edycji przewodnika w adminie, w tym zadaniu.
- **2026-11-23, tj — D5 (b):** wszystkie trzy wiersze deferred z FA-M.03 w zakresie, łącznie z zastąpieniem starego assign/unassign przez send/withdraw i usunięciem starych akcji.
- **2026-11-23 (agent):** kryteria „szablon/okno 24 h” i „fake WhatsApp” usunięte — w wariancie A nie ma wysyłki przez API; zrzut na danych seeda zastąpiony lokalnie utworzonymi danymi (seed nie ma zleceń); dodane kryteria ścieżki oferty, pola numeru i usunięcia starych akcji (D4/D5). Model/effort: opus · high (prompt tj).
- **2026-11-23, tj — STOP przed usunięciem starych akcji (mapa + D1–D5 z PR):**
  - **D1 (b):** „Send request” + akcja admina „Mark accepted on the guide's behalf”. Zdarzenie zapisuje admina jako aktora (`actor_kind admin`), nigdy przewodnika. `requireAdmin()` + red proof.
  - **D2 (a):** wycofanie najnowszego zlecenia odpina też przewodnika od zapytania (z powrotem „No guide”), ze zdarzeniem w tej samej transakcji.
  - **D3 (a):** ta sama migracja pozwala odpiąć przewodnika bez zlecenia (43 stare przypisania na prod), ze zdarzeniem.
  - **D4 (a):** utworzenie zlecenia uzupełnia kraj wyprawy zapytania z kraju przewodnika, gdy jest pusty, w tej samej transakcji.
  - **D5 (a):** wysłanie do nowego przewodnika automatycznie wycofuje poprzednie otwarte zlecenie (dwa zdarzenia). Bez migracji.
  - Format `guide_contacts.phone_e164` na poziomie bazy → `docs/deferred-tasks.md`, nie ten PR.
  - D1–D4 w JEDNEJ nowej migracji (`supabase migration new …`); zastosowanej `20261117000000` nie edytować — nowe funkcje albo `CREATE OR REPLACE` w nowym pliku. `touches_db: true`.
  - STOP przed napisaniem migracji: diff każdej zmienianej funkcji względem `20261117000000` + odczyt definicji z prod; czekać na zgodę.
  - STOP przed merge: migracja trafia na prod wyłącznie przez `deploy-db.yml`, uruchamia tj; nie mergować ani nie prosić o merge przed potwierdzeniem tj.
  - Po zgodzie przy pierwszym STOP wolno usunąć `assignGuideToInquiry`, `assignGuideSilently`, `unassignGuide` i `sendGuideAssignedEmail`.
- **2026-11-23, tj — zgoda przy STOP przed migracją (diff funkcji vs `20261117000000`, prod = plik, md5 `3aeb0bef…` / `76390260…`), z warunkami:**
  1. `accept_guide_request_on_behalf`: `inquiries.guide_responded_at` zostaje NULL — potwierdzone. `guide_requests.answered_at` jest ustawiane (CHECK answer ⇔ answered_at), więc **reguła metryki: każdy czas odpowiedzi przewodnika liczy wyłącznie odpowiedzi z `actor_kind = 'guide'`; odpowiedzi „w imieniu” (`actor_kind = 'admin'`, `payload.on_behalf_of_guide = true`) są wyłączone.** W `docs/REBUILD_PLAN.md` §7 nie ma jeszcze metryki czasu odpowiedzi przewodnika — reguła zapisana przy zdarzeniu `guide.request_answered` w Załączniku C (tam jest „czas zlecenie → odpowiedź (MVP)”) i jako wiersz w `docs/deferred-tasks.md` dla przyszłej metryki.
  2. Obie nowe funkcje: wyjątek przy `p_admin_id IS NULL`; `REVOKE EXECUTE … FROM PUBLIC, anon, authenticated` + `GRANT EXECUTE … TO service_role`. Red proofs: wywołania RPC przez anon i authenticated odrzucone dla obu; NULL admin id rzuca wyjątek. Po `CREATE OR REPLACE` dwóch istniejących funkcji pokazać `proacl` bez zmian (postgres, service_role).
  3. D5 jak opisane: najpierw utworzenie, potem wycofanie pozostałych otwartych zleceń (otwarte = nie wycofane i bez odpowiedzi; także ponowna wysyłka do tego samego przewodnika). Jeśli wycofanie się nie powiedzie, akcja zwraca widoczne ostrzeżenie na karcie („previous link still active — withdraw it manually”), nie cichy sukces. Z testem.
- **2026-11-23 (agent):** `status: review`, PR #211. Migracja `20261122000000` NIE jest na prod — STOP przed merge: wdraża tj przez `deploy-db.yml`. Nazwy TS odpięcia bez zlecenia: `detachGuideWithoutRequest*` (funkcja DB `unassign_guide_without_request` bez zmian), bo grep weryfikacji `unassignGuide` bez granicy słowa łapałby nową nazwę.
- **2026-11-23, tj (wf-review):** accepted PR #211 at 77c3fcd — CI green (check, db, knip, secrets); all five actions requireAdmin with red proofs; ~~migration 20261122000000 applied to prod via deploy-db.yml and verified read-only (proacl + source of create/withdraw/accept_on_behalf/unassign_without_request)~~ **[korekta 2026-11-24: nieprawdziwe w chwili zapisu — 23 XI na prod nie było ani `20261122000000`, ani funkcji `accept_guide_request_on_behalf` / `unassign_guide_without_request`; ostatni `deploy-db.yml` był 18 XI. Stan rzeczywisty — wpis 2026-11-24 niżej]**; legacy assign/unassign/email removed (grep empty). Not covered by the walk: edit-page screenshot (local next/image host, deferred FA-1.86/1.79) and deposit-link generation (tests only) — both checked by tj on prod after merge.
- **2026-11-24 (agent, weryfikacja tj):** migracja `20261122000000` zastosowana na prod przez `migrate-prod` 13:15:05–13:15:18Z, po merge #211 (`974a9c9`, 13:14:34Z). Weryfikacja prod tylko do odczytu (supabase-prod; tj powtórzył zapytanie niezależnie, ten sam wynik): `list_migrations` — ostatnia `20261122000000 fa_m05_guide_request_admin_actions`; cztery funkcje, po jednej wersji, `proacl = {postgres=X/postgres,service_role=X/postgres}`, `prosecdef = false`, `md5(prosrc)` (długość) równe md5 treści między `AS $$` a `$$;` w pliku migracji:
  - `create_guide_request(p_inquiry_id, p_guide_id, p_channel, p_token_hash, p_admin_id)` — `f5bf0a896cfa80d58834b586eb3b758f` (2141)
  - `withdraw_guide_request(p_request_id, p_admin_id)` — `4500c857941368aac4c113ebfe043f03` (1930)
  - `accept_guide_request_on_behalf(p_request_id, p_admin_id)` — `1daeae30c0fa0be9e538fb86cf6ab879` (1995)
  - `unassign_guide_without_request(p_inquiry_id, p_admin_id)` — `65c9450f3752e3fd46c0eb123a81229d` (1136)

  PR #214 (migracja najpierw: migracja + typy + test FA-M.03, identyczne bajtowo z #211, CI zielone na `8e80be8`) zamknięty bez merge jako zbędny — migracja trafiła na `main` przez #211. Deploy produkcyjny Vercel `974a9c9` zakończony 13:16:27Z, ok. 70 s po migracji — bezpiecznie dzięki czasom, nie dzięki kolejności.
