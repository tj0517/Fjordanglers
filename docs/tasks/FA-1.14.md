---
id: FA-1.14
title: Agent w wątku — instalacja — propozycja odpowiedzi w kompozytorze, loader wiedzy, auto-wysyłka wyłączona (treść i logika agenta → FA-1.17)
stage: 1
status: review
difficulty: M
model: sonnet
model_approved:
effort: high
agent: fa-core
branch: feat/agent-in-thread
depends_on: [FA-1.12]
blocked_by_questions: []
touches_db: true
touches_prod: false
estimate_h: 8
owner: tj
---

# FA-1.14 — Agent w wątku: instalacja

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md`
- `docs/01-architecture.md` §3a, §4 — wątek i zdarzenia
- `docs/02-data-model.md` — `messages` (`status='draft'`, `drafted_by`, `channel`)
- `src/lib/ai/inquiry-agent.ts` + testy round1/round2 — dzisiejszy agent; wysyła przez `sendInquiryAgentEmail` (`@/lib/email`)
- `src/lib/ai/extract-trip.ts` — `assembleConversation`
- `src/lib/messages/send.ts`, `src/lib/events/emit.ts`, `src/actions/messages.ts` — wysyłka i `message.sent`
- `src/app/admin/inquiries/[id]/ThreadActionsPanel.tsx` — kompozytor
- `src/lib/env.ts` — `AI_AUTO_REPLY_ENABLED`, `ANTHROPIC_API_KEY`
- `docs/tasks/FA-1.16.md` §Pętla D3 — lokalny stack

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Dziś odpowiedź powstaje przez wklejenie wątku do zewnętrznego AI, a stary agent sam
wysyła klientom maile. Po zadaniu w kompozytorze jest przycisk „zaproponuj”: kod składa
wątek, dane zapytania i pasujące pliki z `docs/knowledge/`, woła model i zapisuje wynik
jako wersję roboczą. Admin edytuje i wysyła. Stary agent nie wysyła nic. **Zadanie
dostarcza instalację, nie treść:** prompt jest zaślepką w jednym pliku, baza wiedzy jest
pusta poza README — treść i logikę agenta (graf działania) robi tj w FA-1.17, bez zmian w kodzie.

## Decyzje tj (21 IX)
- D1 = zakres to sama instalacja; prompt i pliki wiedzy podmienia FA-1.17 bez ruszania kodu.
- D2 = stary agent: wysyłka odłączona, klasyfikacja (qualified, FA-1.04) zostaje, logika rund zostaje w kodzie nieużywana i oznaczona `// FA-1.17` — o jej losie decyduje FA-1.17. Kolumn `agent_status`/`agent_round` nie ruszamy.
- D3 = dowód działania: test na pliku-fikcji + jedno lokalne wywołanie „zaproponuj” z prawdziwym API (lokalny stack; Vercel Preview = baza prod).

## Zakres
- [ ] Odczyt stanu: co robi `inquiry-agent.ts` (kiedy wysyła, co zapisuje); wartość `AI_AUTO_REPLY_ENABLED` w Vercel (preview i production) — odczyt, nie zmiana.
- [ ] `docs/knowledge/README.md` + puste katalogi `{tone,guides,destinations,offers}/`: format frontmatteru (`kind`, `country`, `regions`, `guide_name` lub klucz ustalony z tj) i reguła wyboru plików (tone zawsze; destination po kraju; guide po przewodniku zapytania).
- [ ] `src/lib/ai/knowledge.ts`: `loadKnowledge({ country, guide })` → lista plików z treścią; katalog wiedzy konfigurowalny (testy wskazują fixture).
- [ ] `src/lib/ai/draft-reply-prompt.ts`: jedyne miejsce z tekstem promptu; zaślepka, którą FA-1.17 podmienia.
- [ ] `src/lib/ai/draft-reply.ts`: `draftReply({ inquiryId, counterpart, channel })` → tekst + uzasadnienie (lista użytych plików); zapis `messages` ze `status='draft'`, `drafted_by='agent'`; nie wysyła.
- [ ] Kompozytor: przycisk „zaproponuj”, edytowalny draft, licznik długości dla kanału whatsapp; wysyłka przez zwykły `sendMessage` (zdarzenie z `payload.drafted_by='agent'`).
- [ ] `inquiry-agent.ts`: bez wywołań providera wysyłki; klasyfikacja działa.
- [ ] Testy (niżej).

## Gotowe, gdy
- [ ] Test: `loadKnowledge` na fixture wybiera tone + destination po kraju + guide po przewodniku i pomija resztę; wybrane pliki są w złożonym prompcie.
- [ ] Lokalnie: „zaproponuj” na seedowanym zapytaniu z ≥ 4 wiadomościami zapisuje draft w `messages` (odczyt SQL w raporcie) i pokazuje go w kompozytorze; raport: seed, użyte pliki, odpowiedź.
- [ ] `grep -rn "@/lib/email\|sendInquiryAgentEmail\|sendMessage(\|resend" src/lib/ai/` → 0.
- [ ] Test: przebieg `inquiry-agent` nie woła `@/lib/email` ani `sendMessage` (mock, 0 wywołań) — **pokazany na czerwono** (tymczasowo przywrócone wywołanie → test pada; wynik w raporcie).
- [ ] Test: draft w `messages` nie tworzy wiersza w `inquiry_events`.
- [ ] Test: wysyłka draftu przez `sendMessage` emituje `message.sent` z `payload.drafted_by='agent'`.
- [ ] Test: `draftReply` bez wątku → czytelny błąd.
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` zielone; `knip` bez nowych znalezisk.

## Poza zakresem
- Treść promptu i plików wiedzy, graf działania agenta, los logiki rund starego agenta → FA-1.17.
- Automatyczne odpowiadanie bez admina.
- Baza wiedzy w tabeli, embeddingi, RAG.
- Drop kolumn `agent_status`, `agent_round`; zmiany schematu `messages`.
- WhatsApp w obie strony (FA-1.13), przebudowa UI (FA-1.15).
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Zapis na produkcji: STOP. Vercel Preview wskazuje na bazę prod — „zaproponuj” na preview to zapis na prod.
- Włączenie `AI_AUTO_REPLY_ENABLED=true` gdziekolwiek poza lokalnym env testów: STOP.
- Zmiana env/sekretów w Vercel: STOP.
- Nowa migracja lub edycja istniejącej: STOP.
- `knip` zgłasza odłączoną logikę rund: STOP i pytanie (nie usuwaj — D2).
- Stan bazy ustalasz bieżącym odczytem, nigdy z pamięci, notatek ani pliku typów.

## Weryfikacja
```
pnpm test -- knowledge draft-reply inquiry-agent
grep -rn "@/lib/email\|sendInquiryAgentEmail\|sendMessage(\|resend" src/lib/ai/
pnpm typecheck && pnpm lint && pnpm build && pnpm knip
```

## Notatki z realizacji

Szczegóły w opisie PR. Poniżej skrót.

### Done
- `docs/knowledge/README.md` + puste katalogi tone/guides/destinations/offers (`.gitkeep`)
- `src/lib/ai/knowledge.ts` — `loadKnowledge` z konfigurowalnym `knowledgeDir`; ręczny parser frontmatteru YAML (bez `gray-matter`)
- `src/lib/ai/draft-reply-prompt.ts` — zaślepka `buildDraftPrompt`; FA-1.17 podmienia `STUB_PROMPT` bez ruszania kodu
- `src/lib/ai/draft-reply.ts` — `draftReply` + `DraftReplyError`; zapisuje `status='draft'`, `drafted_by='agent'`, nie emituje `inquiry_events`
- `src/actions/messages.ts` — `proposeDraft` (dynamic import) + `ProposeDraftResult`
- `src/app/admin/inquiries/[id]/MessageComposer.tsx` — przycisk „Zaproponuj" (Sparkles), stan `draftPending`, licznik WA
- `src/lib/messages/send.ts` — `payload.drafted_by` w `message.sent`
- `src/lib/ai/inquiry-agent.ts` — usunięte wywołania `sendInquiryAgentEmail` (×4), oznaczone `// FA-1.17`; klasyfikacja działa

### Done (runda 2 — FA-1.14 review)
- Draft lifecycle: `sendMessage(draftId=…)` UPDATE zamiast INSERT; `draftReply` upsertuje; wątek i AI context pomijają `status='draft'`; `MessageComposer` zapamiętuje i przekazuje `draftId`
- Testy (a)–(c) RED→GREEN; łącznie 33 testów
- `outputFileTracingIncludes` w `next.config.ts`; `console.warn` na brakującym katalogu
- 3 `as any` usunięte z `draft-reply.ts`
- 2 wpisy w `docs/deferred-tasks.md`
- Demo lokalne — pełny lifecycle tsx proof; SQL i zdarzenie potwierdzone

### Done (runda 3 — FA-1.14 review)
- Promotion guard: UPDATE z pełnym WHERE `id AND inquiry_id AND channel AND counterpart AND status='draft'` + `.select('id')`; 0 wierszy → `DraftNotFoundError`; `send.ts` eksportuje klasę
- Testy r3-1 (stale draftId) i r3-2 (mismatch channel/counterpart) RED→GREEN; łącznie 35 testów
- `MessageComposer.tsx` czyści `draftId` przy zmianie `channel` lub `counterpart`
- Reguła RESEND_DEV_FAKE: §10 w `docs/05-agent-operations.md`; guard w `demo-draft-lifecycle.mts`
- Przyznanie rundy 2: wysyłka przez prawdziwe Resend na piotr@example.invalid (brak flagi)

### Done (runda 4 — uzupełnienia)
- Testy r3-1/r3-2 wzmocnione: `capturedUpdateFilters` rejestruje każde `.eq(col, val)` na UPDATE chainie; asercje weryfikują wszystkie 5 warunków WHERE + spy nie wywołany; RED proofs dla usunięcia `status='draft'` i `channel`
- `buildDraftSubject(inquiry, channel)` wyeksportowana z `draft-reply-prompt.ts` (obok `STUB_PROMPT`); `draft-reply.ts` tylko ją woła; testy: email → niepusty, whatsapp/instagram → null; łącznie 308 testów (32 pliki)
- Pole `subject` wypełniane dla kanału email: `Re: Your {country} inquiry — {name}`; zapisywane w draft i promoted; `MessageComposer` wywołuje `setSubject`
- UI demo krok (d): Zaproponuj (angler/email) → guard utrzymał draft jako 'draft'; nowy wiersz sent z `drafted_by='admin'` potwierdzony SQL
- `guides.invite_email = 'erik@fjordanglers.local'` ustawione dla lokalnego seed guide (demo)

### Not done
- Nic z zakresu.

### Noticed, not touched (→ docs/deferred-tasks.md)
- `knowledgeDir` w `env.ts` nie ma (wstrzyknięcie przez parametr zamiast env var) — dopisane do deferred-tasks.md w rundzie 2

### Needs a decision
- Brak.

### Verification

```
# Testy FA-1.14 (30 testów, 5 plików) — GREEN
npx vitest run \
  src/lib/ai/inquiry-agent-round1.test.ts \
  src/lib/ai/inquiry-agent-round2.test.ts \
  src/lib/ai/draft-reply.test.ts \
  src/lib/ai/knowledge.test.ts \
  src/lib/messages/send.test.ts
→ Test Files  5 passed (5)  |  Tests  30 passed (30)

# RED proof — inquiry-agent-round1 z tymczasowo przywróconym sendInquiryAgentEmail
# (gotowy import + jedno wywołanie w ready-path)
# wynik: Test Files  5 failed | 27 passed (32)  |  Tests  2 failed | 287 passed (299)
# wiersz 174: expect(vi.mocked(sendInquiryAgentEmail)).not.toHaveBeenCalled()
# → ^ (czerwony)
# Po usunięciu tymczasowego kodu → 5 passed (5), 30 passed (30)

# grep (produkcja, bez plików testowych) → 0
grep -rn "@/lib/email\|sendInquiryAgentEmail\|sendMessage(\|resend" src/lib/ai/ --exclude="*.test.ts"
→ (brak wyników)

# typecheck / lint / knip — GREEN
pnpm typecheck  → 0 błędów
pnpm lint       → 0 błędów (tylko pre-existing warnings)
pnpm knip       → czysto

# build (stack zatrzymany) — GREEN
pnpm build → ✓ Compiled successfully in 29.9s

# AI_AUTO_REPLY_ENABLED w Vercel (vercel env ls):
# → Encrypted, obecne na Production i Preview; wartość zaszyfrowana (bez pull nieczytelna)
# Stary agent nie woła providerów po FA-1.14 niezależnie od tej flagi.

# Demo lokalne — draftReply na seedowanym zapytaniu (local stack 127.0.0.1:54421)
# Seed: guides id=00000000-... full_name='Josh Hart' country='Iceland'
#       inquiries id=11111111-... angler='Erik Thorvaldsen' trip_country='Iceland'
#       4 messages (2× inbound, 1× outbound, 1× inbound)
# Wywołanie:
#   eval "$(supabase status -o env | grep -E '^(API_URL|SERVICE_ROLE_KEY)=')"
#   NEXT_PUBLIC_SUPABASE_URL=$API_URL SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY \
#   pnpm dlx tsx --tsconfig tsconfig.json --env-file=.env.local .fa-proofs/demo-draft.mts
# Wynik:
#   draftId  : cc563276-bb5c-44db-a801-e19a763501e2
#   usedFiles: []   ← brak plików wiedzy (katalogi puste; FA-1.17 je wypełni; testy na fixture działają)
#   text     : What wonderful news that you'd like to bring your son along — introducing
#              the next generation to fly fishing is something we absolutely love to be
#              part of...

# SQL potwierdzające draft w messages:
SELECT id, direction, channel, status, drafted_by, left(body,80) body_preview
FROM messages
WHERE inquiry_id = '11111111-1111-1111-1111-111111111111'
ORDER BY occurred_at;
-- cc563276...  outbound  email  draft  agent  "What wonderful news that you'd like..."

# SQL potwierdzające brak inquiry_events:
SELECT count(*) FROM inquiry_events WHERE inquiry_id = '11111111-1111-1111-1111-111111111111';
-- 0
```
