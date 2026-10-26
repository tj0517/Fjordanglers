---
id: FA-1.72
title: Auto-wysyłka odwrócona — agent wysyła domyślnie, wstrzymuje tylko przy krytycznym naruszeniu; score informacyjny, brak wpisu destination nie blokuje, sufit 20/24 h, sędzia bez uciętego JSON
stage: 1
status: todo
difficulty: M
model: opus
model_approved:
effort: high
agent: fa-core
branch: fix/fa-1.72-auto-send-default-send
depends_on: [FA-1.47, FA-1.48]
blocked_by_questions: []
touches_db: false
touches_prod: true
estimate_h: 5
owner: tj
---

# FA-1.72 — Agent wysyła, chyba że złamał coś krytycznego

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md`
- `docs/tasks/FA-1.27.md` — pierwotne bramki auto-wysyłki (sędzia ≥ 0.9, stany „nigdy auto”)
- `docs/tasks/FA-1.47.md` — sędzia dostaje wiedzę szkicu jako źródło prawdy
- `docs/tasks/FA-1.42.md` — dzienny sufit, `AI_AUTO_SEND_DAILY_CAP`
- `docs/tasks/FA-1.48.md` — przejęcie wątku przez człowieka (bez zmian)
- `docs/deferred-tasks.md` wiersz FA-1.61 — ucięty JSON sędziego (`max_tokens: 256`), 6 z 66 decyzji
- `src/lib/ai/judge-reply.ts`, `src/lib/ai/auto-send.ts`, `src/lib/ai/auto-send-guards.ts`
- `src/lib/ai/judge-reply.test.ts`, `src/lib/ai/auto-send.test.ts`

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Dziś agent prawie nigdy nie wysyła. Wysyłka wymaga naraz `score ≥ 0.9` i `send=true`, a sędzia (Haiku) ma polecenie „be strict; when in doubt, score below the threshold” i dziewięć reguł „nigdy auto”, z których połowa odpala niemal zawsze („pytanie spoza wiedzy”, „wiadomość niejasna”, „szkic proponuje cenę”, „twierdzenie, które mogłoby być błędne”, „łamie jakąkolwiek regułę z instrukcji”). Do tego brak wpisu `destination` blokuje przed sędzią, sufit to 5/24 h, a część werdyktów ginie na uciętym JSON.

Miało być odwrotnie (decyzja tj 2026-10-26): **agent wysyła domyślnie; nie wysyła tylko wtedy, gdy zachodzi krytyczna sytuacja albo szkic złamał krytyczną regułę.** Po zadaniu sędzia odpowiada na pytanie „czy jest powód krytyczny, żeby NIE wysłać?”, a nie „czy jestem pewny na 90%”.

## Dane z produkcji (odczyt tj 2026-10-26, powody `sent=false`)
- 71 wstrzymań to bramki kodu działające zgodnie z założeniem (status poza `new`/`qualifying`: 57, przejęcie przez człowieka: 14) — **bez zmian**.
- 35 wstrzymań przez sędziego:
  - 10 to ucięty JSON (`Could not parse judge response`) — werdykt utracony; jeden z nich to `score 0.95, send=true`, czyli **gotowa wysyłka zgubiona**.
  - ~15 nadmiernej ostrożności, które po zmianie mają przejść: „pricing needs admin review” przy cenie zgodnej z bazą (1 440 NZD), „full days only — cannot be verified” choć baza to mówi, „klient napisał, że wróci później”, „half-day to custom arrangement”, „season licence needs confirmation”, „beginner wife — unverified”.
  - ~20 słusznych (wg zasad z tamtego dnia): imię guida (Kristina) w szkicu przed `paid` — **od 2026-10-26 dozwolone**, wymyślone daty („four dates”, „ten dates”, „June 15–18”, „22nd of **October**”), Southland zamiast zgłoszonej luki Queenstown, cena wielodniowa, której baza nie zna, sprzeczność z wcześniejszą wiadomością w wątku. Te muszą dalej zatrzymywać — 9 z nich łapie dopiero grupa 5. **Zastrzeżenie:** część „wymyślonych” dat i lokalizacji mogła pochodzić z formularza, którego sędzia nie widział (patrz Zakres: „Sędzia widzi to samo co piszący szkic”) — tj weryfikuje na prod przed startem.

## Decyzje tj (2026-10-26)
- D1 Model decyzji: wysyłka ⇔ `send=true` od sędziego. `score` zostaje w odpowiedzi i w evencie `agent.auto_send_decided` jako informacja, **nie jest bramką**. `JUDGE_THRESHOLD` usunięte z decyzji (stała usunięta albo oznaczona jako nieużywana do bramki — zgłoś, co wybrałeś).
- D2 Twarde STOP (`send=false`) — tylko te cztery grupy:
  1. Skarga / negatywny ton wobec FA / coś poszło nie tak (problem z rezerwacją, zwrot, nadpłata, błąd).
  2. Klient porównuje FA z konkurencją.
  3. Klient prosi o bezpośredni kontakt do guida (telefon, mail, profil).
  4. Szkic jest sprzeczny z wiedzą: cena lub warunek inne niż w bazie wiedzy, **konkretne zobowiązanie spoza bazy** (cena, termin, dostępność konkretnego dnia/guida, warunki niestandardowe), albo złamanie zakazu z wpisu `instructions` (m.in. obietnica daty, **potwierdzenie dostępności guida w konkretnym dniu**, obejście luki w pokryciu jak Queenstown zamiast powiedzenia wprost). **Imię guida i to, gdzie działa, NIE jest powodem do blokady** (decyzja tj 2026-10-26, zmiana zasady — patrz FA-1.73 D1)..
  5. **(proponowane — tj potwierdza przed startem)** Szkic przeinacza rozmowę: wymyśla daty, miesiąc, lokalizację, liczbę osób, których klient nie podał, albo przeczy wcześniejszej wiadomości FA w wątku (inna cena, wycofanie się z obietnicy).
- D3 Brak aktywnego wpisu `destination` dla kraju **nie blokuje** — szkic idzie do sędziego. Ochrona zostaje przez D2.4: bez wiedzy o kraju każda cena/warunek w szkicu jest „spoza bazy” → STOP.
- D4 Domyślny sufit auto-wysyłek: 20 / 24 h (env `AI_AUTO_SEND_DAILY_CAP` dalej nadpisuje).

## Zakres
- [ ] Odczyt stanu na `main`: wkleić aktualny `JUDGE_PROMPT`, `KNOWLEDGE_RULE`, linię `shouldSend`, Gate 4 i `DEFAULT_AUTO_SEND_DAILY_CAP`.
- [ ] `judge-reply.ts` — nowy prompt:
  - domyślny werdykt `send=true`; `send=false` wyłącznie przy D2.1–D2.4, a każdy `reasons[]` przy `send=false` nazywa, która z czterech grup zaszła;
  - wprost wypisane jako **NIE-powody** do blokady: niejasne lub krótkie pytanie klienta, pytanie, na które baza nie ma odpowiedzi, **jeśli szkic tego nie zmyśla** (np. „sprawdzimy i wrócimy”), podanie ceny zgodnej z bazą, drobne odstępstwa stylu/tonu, ponowne dopytanie o coś, co już padło, ogólnikowe uprzejmości;
  - usunięte: „be strict; when in doubt, score below the threshold” i wzmianka o progu 0.9;
  - `KNOWLEDGE_RULE` dopasowany do D2.4 (sprzeczność / konkretne zobowiązanie spoza bazy → `send=false`; zgodne z bazą = zweryfikowane);
  - `score` opisany jako ocena jakości do statystyk, bez wpływu na wysyłkę;
  - `reasons` ograniczone w prompcie (max 3, krótkie) **i** `max_tokens` podniesione (np. 512) — domyka deferred FA-1.61.
- [ ] `auto-send.ts` — `shouldSend = judged.send`; Gate 4 (destination) usunięta jako bramka, `loadKnowledge` zostaje tylko jeśli nadal potrzebne (inaczej usunąć martwy odczyt); komentarz nagłówkowy pliku zaktualizowany.
- [ ] Bez zmian: bramki 1–3b (tylko klient, tylko e-mail, status `new`/`qualifying`, przejęcie przez człowieka), dzienny sufit liczony na końcu, błąd sędziego / błąd parsowania = **nie wysyła** (fail-safe — wysłanego maila nie cofniesz), szkic zawsze zapisany.
- [ ] **Sędzia widzi to samo co piszący szkic.** Dziś `draftReply` zawsze dostaje blok `=== ORIGINAL INQUIRY ===` z `assembleConversation` (wybrane doświadczenie, `requested_dates`, liczba osób, brief, potem historia), a sędzia w `auto-send.ts` dostaje: przy niepustym wątku — same wiadomości, bez danych formularza; przy tekście w formularzu — sam tekst; pełny blok tylko gdy formularz nie ma tekstu (FA-1.46). Skutek w danych prod: sędzia zarzuca „wymyślone daty / lokalizację”, które mogły przyjść z formularza. Po zmianie `conversationText` sędziego = ten sam wynik `assembleConversation` co w `draftReply` we wszystkich trzech przypadkach (najlepiej jedna wspólna funkcja, żeby się nie rozjechały).
- [ ] `auto-send-guards.ts` — `DEFAULT_AUTO_SEND_DAILY_CAP = 20`.
- [ ] Testy zaktualizowane (stare asercje „0.85 → nie wysyła” zamienione na nową regułę).

## Gotowe, gdy
- [ ] Test `autoSendReply`: sędzia (mock) `{score: 0.55, send: true}` → **wysyłka** (RED na `main`: tam nie wysyła).
- [ ] Test `autoSendReply`: `{score: 0.97, send: false}` → brak wysyłki, `reasons` sędziego w evencie.
- [ ] Test `autoSendReply`: brak wpisu `destination` + `{send: true}` → wysyłka (RED na `main`: zatrzymuje Gate 4).
- [ ] Test sufitu: 19 w oknie → wysyła; 20 → `daily auto-send cap reached` (RED na `main` dla 5–19).
- [ ] Test `judgeReply`: odpowiedź modelu ucięta w połowie JSON → rzuca, a `autoSendReply` → `sent=false` z powodem `judge error` (fail-safe zachowany); `max_tokens` w wywołaniu ≥ 512.
- [ ] Test `autoSendReply`: zapytanie z formularza z tekstem **i** `requested_dates` + wybranym doświadczeniem, oraz zapytanie z niepustym wątkiem — wejście sędziego zawiera `Requested dates:` i `Experience requested:` identyczne jak wejście `draftReply` (RED na `main`: brak tych linii).
- [ ] Test `judgeReply`: `userContent` nie zawiera „when in doubt” ani „0.9”; zawiera cztery grupy STOP i listę NIE-powodów.
- [ ] Przypadek zachowania z prawdziwym modelem (`ANTHROPIC_API_KEY` z `.env.local`, skrypt w `.fa-proofs/fa-1.72/` woła tylko `judgeReply` na fikcyjnych danych, bez bazy i maila, jak FA-1.47 D3). Wynik `{score, send, reasons}` wklejony dla każdego:
  1. NZ, pierwsze zapytanie, szkic z ceną zgodną z bazą + pytanie o daty → `send=true`
  2. Krótkie, niejasne „Hi, is fishing good in March?” + szkic bez zmyśleń, z pytaniem zwrotnym → `send=true`
  3. Pytanie spoza bazy, szkic „sprawdzimy u guidów i wrócimy” → `send=true`
  4. Szkic z ceną inną niż w bazie → `send=false`
  5. Szkic obiecujący konkretny dzień / imię guida → `send=false`
  6. Klient skarży się na poprzedni wyjazd → `send=false`
  7. Klient: „X offers it cheaper” → `send=false`
  8. Klient prosi o numer guida → `send=false`
  9. Brak wpisu destination, szkic podaje cenę → `send=false`; ten sam bez ceny, z pytaniem o szczegóły → `send=true`
  10a. Szkic: „Kristina guides the Southland rivers — we'll check if she's free on the 12th” → `send=true`
  10b. Szkic: „Kristina is free on 12 September” / „the 12th works for her” → `send=false`
  11. Klient nie podał dat, szkic pisze „those four dates” / dopisuje miesiąc → `send=false` (grupa 5)
  12. Klient pyta o Queenstown, szkic proponuje Southland z ceną zamiast powiedzieć o luce → `send=false`
  13. Szkic z ceną zgodną z bazą i „full days only” zgodnym z wpisem guida → `send=true` (dawniej „needs admin review” / „cannot be verified”)
  14. Formularz z datami 17, 18, 19, 23 i tekstem bez dat, szkic wymienia „those four dates” → `send=true` (daty z formularza, nie halucynacja)
  Przypadki 10–14 odtworzone na fikcyjnych danych z powodów z produkcji (sekcja „Dane z produkcji”).
  Jeśli któryś przypadek wychodzi źle — raport z powodami, **bez** dalszego luzowania na własną rękę.
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` zielone; CI na head PR zielone (`check`, `knip`, `db`, `secrets`).

## Poza zakresem
- Kanały WhatsApp/Instagram, auto-wysyłka do guidów, statusy poza `new`/`qualifying` → bez zmian.
- Prompt piszącego szkic (`draft-reply.ts`) i treść wpisów wiedzy → nie ruszać. Błędy szkicu z danych prod (imię guida, wymyślone daty, obchodzenie luk) → osobne zadanie na drafter.
- Zmiana modelu sędziego z Haiku → nie w tym zadaniu.
- Bateria FA-1.44 → osobno (ten przypadek zachowania jej nie zastępuje).
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- STOP przed merge: tj czyta nowy prompt sędziego i wyniki 13 przypadków z prawdziwym modelem i akceptuje.
- Zmiana działa na prod po deployu kodu — po merge tj obserwuje pierwsze wysyłki w `inquiry_events` (`agent.auto_send_decided`, `sent=true`) i w razie potrzeby obniża `AI_AUTO_SEND_DAILY_CAP` albo wyłącza flagę auto-odpowiedzi.
- Agent nie zmienia env na Vercelu i nie wysyła prawdziwych maili.

## Weryfikacja
```
pnpm test -- judge-reply auto-send
pnpm typecheck && pnpm lint && pnpm test && pnpm build
git diff main...HEAD -- src/lib/ai/
```

## Notatki z realizacji
- 2026-10-26 tj: decyzje D1–D4 (wyżej). Wiersz do `docs/tasks/INDEX.md` (zasada o imieniu guida zmieniona tego samego dnia — patrz FA-1.73):
  `| FA-1.72 | Auto-wysyłka odwrócona — wysyła domyślnie, STOP tylko przy krytycznym naruszeniu; score informacyjny, bez bramki destination, sufit 20, sędzia bez uciętego JSON | M | opus | todo | FA-1.47, FA-1.48 |`
- Zamyka deferred FA-1.61 (ucięty JSON sędziego).
- 2026-10-26 odczyt prod (tj, 10 zapytań z „wymyślonymi” danymi): **5 z 5 „wymyślonych dat/lokalizacji” było w formularzu** (`requested_dates`, wybrana wycieczka) — b18cb597 (4 daty), a86b0a0b (10 dat + Coyhaique), 3723005c (15–18 VI), 0f07cc89 (22 X). Ślepota sędzia potwierdzona; poprawka wejścia sędziego to najważniejsza część zadania. Prawdziwe błędy szkicu (imię guida, South Island ≠ Southland) → FA-1.73.
