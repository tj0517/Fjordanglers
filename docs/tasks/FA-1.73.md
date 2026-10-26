---
id: FA-1.73
title: Szkic agenta — imię guida dozwolone, ale bez obiecywania jego dostępności; wybrana wycieczka i jej tytuł to wskazówka, nie wiążący wybór — rejon i styl z wiadomości klienta; luka Queenstown = powiedziane wprost + Southland jako opcja
stage: 1
status: todo
difficulty: M
model: opus
model_approved:
effort: high
agent: fa-core
branch: fix/fa-1.73-draft-guide-availability-location
depends_on: [FA-1.72]
blocked_by_questions: []
touches_db: false
touches_prod: true
estimate_h: 5
owner: tj
---

# FA-1.73 — Szkic: guide z imienia tak, jego dostępność nie; miejsce od klienta

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md`
- `docs/tasks/FA-1.72.md` — odwrócona auto-wysyłka, sędzia z pełnym wejściem (ten task idzie po nim: ten sam `auto-send.ts`)
- `src/lib/ai/draft-reply.ts` — prompt i wejście piszącego szkic
- `src/lib/ai/extract-trip.ts` (`assembleConversation`) — blok `ORIGINAL INQUIRY` (`Experience requested: …`)
- `src/lib/ai/knowledge.ts` — `loadKnowledge`; wpisy `guide` ładują się tylko przy `assigned_guide_id`
- `src/lib/ai/auto-send.ts` — miejsce na nową bramkę przed sędzią
- `guides.full_name` (`src/lib/supabase/database.types.ts`)

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Odczyt prod 2026-10-26 (tj) pokazał dwa prawdziwe błędy szkicu — nie sędziego:
1. **Dostępność guida podana jak fakt / sugerowana** — szkice z „Kristina” (4568d540, d189dfe6, b18cb597). Samo imię od 2026-10-26 jest dozwolone (D1); problemem jest, gdy szkic mówi lub sugeruje, że guide jest wolny w danym dniu — to może potwierdzić tylko guide.
2. **„South Island” czytane jako „Southland”** — każde zapytanie z tej wycieczki dostaje Southland/Lumsden + cenę, gdziekolwiek klient jest: Queenstown (215ff3b1, 2fc95c88, 0f07cc89 — luka w wiedzy), Nelson (2640acd6, ~10 h od Lumsden), brak miejsca (d189dfe6). Dobre dopasowanie tylko Kingston (4568d540).

Po zadaniu: agent może napisać, który guide działa w danym rejonie, ale nigdy nie twierdzi, że jest wolny w konkretnym dniu — zawsze „sprawdzimy, czy jest wolny”; a miejsce bierze się z tego, co napisał klient; tytuł wycieczki to tylko kraj/wyspa.

## Decyzje tj (2026-10-26)
- D1 (zmiana zasady, tj 2026-10-26, zastępuje wcześniejszą decyzję o blokadzie imienia w kodzie): **imię guida i rejon, w którym działa, wolno podać klientowi** („Kristina guides the Southland rivers”). **Nie wolno** twierdzić ani sugerować dostępności w konkretnym dniu („Kristina is free on 12 September”, „the 12th works for her”) — tylko „we'll check whether she's free on the 12th”. Bramka = sędzia (FA-1.72, grupa 4); bez blokady imienia w kodzie (rozpoznanie „dostępności” to semantyka, nie lista słów).
- D3 (tj 2026-10-26, zasada ogólna, wszystkie kraje): **wybór wycieczki i jej tytuł nie są wiążące.** Klient klika stronę, bo tam trafił z reklamy albo wyszukiwarki — to mówi o kraju i ewentualnie o guidzie, a nie o rejonie czy stylu wyjazdu. Przykład z Islandii: guide działa w całym rejonie Reykjavíku, a jego wycieczka nazywa się „Highland … with Bergur”, więc agent zawsze pisze o Highlandach, choć klient chce po prostu Islandii, a Highlandy to tylko dodatek. Po zmianie:
  - rejon, styl, długość = to, co klient napisał (wiadomość, brief, wątek); tytuł wycieczki tylko je uzupełnia, gdy klient nic nie powiedział;
  - słowa z tytułu (Highland, South Island, Spring Creeks…) agent może wspomnieć jako **jedną z opcji**, nie jako założenie;
  - gdy klient nie dał żadnej wskazówki co do rejonu, a kraj ma kilka rejonów lub guide działa szeroko → odpowiedź ogólna dla kraju/guida + pytanie o preferencje; nie zawężaj do tytułu;
  - w wejściu modelu etykieta `Experience requested: …` zmieniona tak, żeby to mówiła (np. `Trip page the client came from (hint only — not the client's choice of region or style): …`); ta sama etykieta trafia do sędziego (FA-1.72 — jedno źródło wejścia), więc sędzia też nie traktuje tytułu jako wyboru klienta.
- D1-wiedza: zakaz „Before `paid`, a client never gets the guide's name” we wpisie `instructions` **musi zniknąć**, inaczej sędzia (czyta `instructions` jako źródło prawdy) dalej zablokuje każde imię. Telefon, mail, profil guida — dalej zakazane. Zmianę treści robi tj w `/admin/knowledge`.
- D2 Luka Queenstown: agent mówi wprost, że z Queenstown codziennie nie obsługujemy, i proponuje Southland jako opcję — dojazd ok. 1–1,5 h, pełny dzień, cena z wiedzy — kończy pytaniem, czy dojazd pasuje. Bez imienia guida.

## Otwarte pytania
- **O-48** Miejsce w luce **daleko** od pokrytego obszaru (Nelson, Christchurch, Wyspa Północna) — **resolved 2026-10-26 (tj):** agent pisze, że sprawdzi ofertę dostępnych guidów w tym rejonie i wróci („we'll check what our available guides can offer in that area and come back to you”); bez ceny, bez proponowania odległego rejonu, bez deklarowania, że nikogo tam nie ma. Wiadomość idzie automatycznie (nie STOP).

## Zakres
- [ ] Odczyt stanu: prompt `draft-reply.ts` (fragmenty o miejscu i guidach), aktualne treści wpisów `instructions` i `destination` NZ z bazy lokalnej/seed — wkleić fragmenty z „Kristina”, „Queenstown”, „gap”.
- [ ] Prompt `draft-reply.ts`, reguły dopisane wprost:
  - imię guida i jego rejon — wolno; telefon, mail, profil — nigdy przed `paid`;
  - dostępność guida/daty nigdy jako fakt — zawsze „we'll check whether <guide> is free on <date>”;
  - miejsce i styl = to, co klient napisał w wiadomości/briefie/wątku; wybrana wycieczka to tylko wskazówka (D3); „South Island” ≠ „Southland”, „Highland …” ≠ „klient chce Highlandy”;
  - klient nie podał miejsca na wycieczkę z kilkoma rejonami → zapytaj o miejsce, zanim podasz cenę rejonu;
  - miejsce w luce z wiedzy → D2 (Queenstown/okolice) albo O-48 (daleko: „sprawdzimy ofertę dostępnych guidów i wrócimy”).
- [ ] Propozycja zmian treści — **tylko jako tekst w raporcie**; tj wpisuje w `/admin/knowledge`, agent nie zmienia bazy:
  - `instructions`: usunięty zakaz imienia przed `paid`, dopisany zakaz deklarowania dostępności (D1);
  - `destination` NZ: Queenstown = luka + opcja Southland z czasem dojazdu (D2).
- [ ] Testy.

## Gotowe, gdy
- [ ] Etykieta tytułu wycieczki w `assembleConversation` zmieniona wg D3; sprawdzić wszystkich wywołujących (`draftReply`, sędzia po FA-1.72, `extract-trip`) — zgłoś, czy `extract-trip` też ma dostać nową etykietę, czy zostaje stara.
- [ ] Test promptu `draftReply`: wysłany prompt zawiera regułę o dostępności, regułę D3 i nową etykietę tytułu wycieczki, nie zawiera zakazu imienia guida (RED na `main`).
- [ ] Przypadek zachowania z prawdziwym modelem (`draftReply` na lokalnym stacku z fikcyjnymi zapytaniami i wiedzą jak na prod, bez maila; skrypt w `.fa-proofs/fa-1.73/`), szkic wklejony dla każdego:
  1. South Island, klient w Queenstown, 1 dzień → luka wprost + Southland ~1–1,5 h + cena + pytanie o dojazd
  2. South Island, klient w Kingston, prosi o 3. dzień miesiąca → Southland + cena, może nazwać guida, „sprawdzimy, czy jest wolna 3.” — nigdy „jest wolna”
  3. South Island, brak miejsca → pytanie o miejsce, bez ceny rejonu
  4. South Island, klient w Nelson → „sprawdzimy ofertę dostępnych guidów w tym rejonie i wrócimy”; bez ceny, bez Southland (O-48)
  5. Coyhaique, 10 dat z formularza → odnosi się do dat z formularza, bez deklarowania dostępności
  6. Islandia, wycieczka „Highland … with Bergur”, klient: „chcemy 2 dni łowienia na Islandii w lipcu”, bez rejonu → odpowiedź o Islandii/rejonie guida ogólnie, Highlandy najwyżej jako jedna z opcji, pytanie o preferencje; **nie** zakłada Highlandów
  7. Ta sama wycieczka, klient: „interesują nas Highlandy” → szkic o Highlandach (tytuł zgodny z klientem — wolno)
  Dla 1, 2, 5, 6 i 7 dodatkowo `judgeReply` (wiedza z poprawionym `instructions`) → `send=true`.
  Jeśli któryś szkic wychodzi źle — raport, bez dalszego dokręcania promptu na własną rękę.
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build`; CI zielone.

## Poza zakresem
- Prompt i reguły sędziego → FA-1.72.
- Zmiany treści w `agent_knowledge` na prod → tj w adminie.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- STOP przed włączeniem na prod: tj zmienia wpis `instructions` (D1-wiedza) — bez tego sędzia blokuje imiona mimo nowego promptu szkicu.
- STOP przed merge: tj czyta szkice z 7 przypadków.
- Agent nie zmienia `agent_knowledge` na prod i nie wysyła maili.

## Weryfikacja
```
pnpm test -- auto-send draft-reply
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

## Notatki z realizacji
- 2026-10-26 tj: D2; D1 najpierw „blokada imienia w kodzie”, tego samego dnia zmienione na „imię wolno, dostępności nie”. Wiersz do `docs/tasks/INDEX.md`:
  `| FA-1.73 | Szkic — imię guida wolno, dostępności nie; tytuł wycieczki to wskazówka, rejon/styl z wiadomości klienta (South Island ≠ Southland, Highland ≠ wybór klienta), luka Queenstown = wprost + Southland | M | opus | todo | FA-1.72 |`
- Tego samego dnia D3 (tytuł wycieczki niewiążący, ogólnie dla wszystkich krajów; przykład Islandia/Bergur/Highland). Do `docs/04-open-questions.md`: `| O-48 | Miejsce w luce daleko od pokrytego obszaru (Nelson, Wyspa Północna) | (a) luka wprost, pytanie o elastyczność; (b) + Southland; (c) STOP auto | FA-1.73 | **resolved 2026-10-26 (tj)**: sprawdzimy ofertę dostępnych guidów w tym rejonie i wrócimy — bez ceny i bez odległej alternatywy |`
