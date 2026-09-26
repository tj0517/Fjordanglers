---
id: FA-1.17
title: Treść i logika agenta, część 1 — graf działania, instrukcje, ton i Nowa Zelandia, wpisane przez panel; ocena na 3 wątkach
stage: 1
status: done
difficulty: M
model: — (człowiek)
model_approved:
effort:
agent:
branch:
depends_on: [FA-1.21, FA-1.22, FA-1.23, FA-1.24]
blocked_by_questions: []
touches_db: true
touches_prod: true
estimate_h:
owner: tj
---

# FA-1.17 — Treść i logika agenta, część 1

## Kontekst — przeczytaj przed startem
- `docs/archive/agent-rules-v1.md` — reguły starego agenta (FA-1.25); **podstawa wpisu `instructions`**, nie pisanie od zera
- Szkic v2 z 22 IX w `Claude outputs/fa-1.17/`: `02-instructions.md` (reguły starego agenta + warstwa komunikacji + decyzje tj), `03-tone.md` (skill korespondencji + „Voice”), `04`–`07` (NZ + 3 przewodników, v1 — do przejrzenia z tj)
- `/admin/knowledge` (FA-1.24) — tu wpisujesz treść
- `docs/tasks/FA-1.21.md` — co agent dostaje w nagłówku (adresat, kanał, status, przewodnik)
- `docs/01-architecture.md` §4 — statusy, na których opiera się graf
- Skill Cowork `fa-klient-korespondencja`; dokumenty projektu `guides/`, `guides/INDEX.md`
- Szkice z 21 IX w `Claude outputs/`: `client-correspondence.md` (ton), `new-zealand.md`, `josh-hart.md` — poprawić przy przepisywaniu: kraj jako „New Zealand”, przewodnik wybierany z listy, nie po nazwisku

## Cel
Instalacja (FA-1.14) i baza wiedzy (FA-1.21–1.24) działają, ale agent mówi zaślepką. Tu
powstaje to, jak agent postępuje: graf działania (co robi na każdym etapie rozmowy, o co
pyta i kiedy, kiedy proponuje ofertę, jak prowadzi follow-upy, jak pisze do przewodnika),
zapisany jako aktywne instrukcje, plus ton i Nowa Zelandia jako pierwszy kraj. Robi tj,
przez panel, na produkcji po wdrożeniu paczki z FA-1.21–1.24.

## Decyzje tj (22 IX)
- Instrukcje i wiedza żyją w bazie, edycja w panelu (O-20, opcja C).
- Ocena na produkcji po wdrożeniu: „zaproponuj” tworzy tylko wersję roboczą, nic nie wychodzi bez „Wyślij”.
- IS, NO i pozostali przewodnicy → FA-1.26.
- Stara logika rund → FA-1.25 (usunięta).

## Zakres
- [ ] Graf działania (dokument/diagram): etapy wg statusów §4 × adresat (klient / przewodnik) → co agent proponuje.
- [ ] Wpis `instructions`: graf przełożony na instrukcje dla modelu.
- [ ] Wpis `tone`: z `client-correspondence.md`.
- [ ] Wpis `destination` New Zealand; wpisy `guide`: Josh Hart, Dustin Haberner, Kristina Placko.
- [ ] Ocena na 3 prawdziwych zapytaniach na prod.

## Gotowe, gdy
- [x] Na 3 zapytaniach na prod (nowe zapytanie od klienta z wiadomością w wątku, prośba o cenę do przewodnika, follow-up po ofercie) draft nie wymaga przepisywania od zera — ocena tj; w notatkach: id zapytań, id draftów, ocena i co poprawiono we wpisach. (Zawężone 26 IX decyzją tj: zapytanie z pustym wątkiem, czyli z formularza → FA-1.34.)
- [ ] Draft do przewodnika jest pisany do przewodnika, a draft do klienta do klienta — widać w tych 3 draftach.
- [ ] `/admin/knowledge` sekcja „braki” nie pokazuje braku instrukcji, tonu ani New Zealand.

## Poza zakresem
- IS, NO, SE, FI i ich przewodnicy → FA-1.26.
- Zmiany w kodzie — jeśli potrzebne, osobne zadanie.
- Auto-wysyłka bez admina → FA-1.27 (decyzja tj 2026-09-22: hybryda — auto tylko gdy sędzia ≥ 0.9 i żaden stan „nigdy auto”).
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Wysłanie draftu z oceny do prawdziwego klienta lub przewodnika — tylko świadomie, jako normalna odpowiedź, nie jako test.
- Włączenie `AI_AUTO_REPLY_ENABLED=true` — STOP; włącza tj po FA-1.27 i po ocenie z tego zadania.

## Weryfikacja
- `/admin/knowledge` → sekcja „braki” (zrzut).
- Id 3 zapytań i draftów w notatkach.

## Notatki z realizacji
- 2026-09-22 tj (/wf-task, wywiad): grupy krajów — oferta od przewodnika: NO, IS, FI (średnia cena z wpisu kraju dozwolona jako widełki); oferta stała: NZ, Patagonia, SE (zawsze cena + pytanie na końcu). Komplet danych → cena + „pasuje? sprawdzimy, który przewodnik jest wolny”; bez nazwiska przewodnika. NZ: nie pytamy o nocleg. Pierwsze pytanie: daty i długość; przy kilku dniach (poza NZ) nocleg nasz czy klienta.
- 2026-09-22 tj: cena „od” z wpisu przewodnika tylko z jednostką; brak faktu → zdanie do klienta „potwierdzę i wrócę”; zawsze angielski.
- 2026-09-22 tj: reguły starego agenta (`AGENT_RULES`) zostają jako fundament instrukcji, rozszerzone o ton i zasady komunikacji.
- Otwarte na 23 IX: (1) budżet przy NO/IS/FI — przyjęta roboczo reguła starego agenta (pytamy; multi-day obowiązkowo; odmowa → widełki); (2) co pisze agent przy ofercie od przewodnika z kompletem danych; (3) podpis w mailu; (4) przegląd wpisów NZ + Josh, Dustin, Kristina (marża 20% na transferze Kristiny, nazwa firmy Kristiny, nazwisko Dustina).
- 2026-09-26 tj (odbiór w wf-next): wpisy odczytane SQL-em na prod 26 IX — `instructions`, `tone`, `destination` New Zealand, `guide` Josh Hart, Dustin Haberner, Kristina Placko, wszystkie aktywne. Szkice ocenione przez tj na kilku wątkach prod: „zaliczam”. Id udowodnione odczytem: follow-up po ofercie — zapytanie `9759c20a` (James Martin, NZ), szkic `1892fadd`. Szkic do przewodnika i szkic na nowe zapytanie — ocena tj, bez id w odczycie. Kryterium 1 zawężone: agent odmawia przy pustym wątku (`src/lib/ai/draft-reply.ts:72`) → FA-1.34. Punkty otwarte 23 IX nie odnotowane osobno.
