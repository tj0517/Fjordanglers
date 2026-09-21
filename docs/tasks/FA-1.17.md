---
id: FA-1.17
title: Treść i logika agenta — baza wiedzy (pliki) i graf działania (prompt, kroki, kiedy o co pyta)
stage: 1
status: todo
difficulty: M
model: — (człowiek)
model_approved:
effort:
agent:
branch: docs/agent-knowledge
depends_on: [FA-1.14]
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h:
owner: tj
---

# FA-1.17 — Treść i logika agenta

## Kontekst — przeczytaj przed startem
- `docs/knowledge/README.md` — format plików (z FA-1.14)
- `src/lib/ai/draft-reply-prompt.ts` — prompt-zaślepka do podmiany
- `src/lib/ai/inquiry-agent.ts` — odłączona logika rund, oznaczona `// FA-1.17`
- Skill Cowork `fa-klient-korespondencja`, dokumenty projektu `guides/`, `guides/INDEX.md`
- Szkice z 21 IX: `tone/client-correspondence.md`, `guides/josh-hart.md`, `destinations/new-zealand.md` (Cowork outputs)

## Cel
Instalacja z FA-1.14 działa, ale mówi zaślepką. Tu powstaje to, co agent wie i jak
postępuje: pliki wiedzy, prompt i graf działania — co robi przy nowym zapytaniu, o co
pyta i kiedy, kiedy proponuje ofertę, jak prowadzi follow-upy. Zmiany tylko w
`docs/knowledge/` i `draft-reply-prompt.ts`; kod poza promptem bez zmian.

## Zakres
- [ ] Graf działania agenta (dokument/diagram): etapy rozmowy → co agent proponuje na każdym.
- [ ] Prompt w `draft-reply-prompt.ts` zgodny z grafem.
- [ ] Pliki wiedzy: tone + kraje i przewodnicy z aktywnych (start: NZ, IS, NO).
- [ ] Decyzja o logice rund starego agenta: usunąć albo przenieść do grafu.

## Gotowe, gdy
- [ ] Na 3 prawdziwych wątkach (lokalnie, kopia danych albo seed) draft nie wymaga przepisywania od zera — ocena tj, wątki i drafty w notatkach.
- [ ] Każdy aktywny przewodnik z `guides/INDEX.md` ma plik albo świadome „pomijam”.
- [ ] Logika rund: usunięta albo użyta; `knip` czysty.

## Poza zakresem
- Zmiany w loaderze, `draftReply`, UI — jeśli potrzebne, osobne zadanie.
- Auto-wysyłka bez admina.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
brak (bez bazy i produkcji); włączenie `AI_AUTO_REPLY_ENABLED=true` — STOP.

## Weryfikacja
```
pnpm test -- knowledge draft-reply
pnpm knip
```

## Notatki z realizacji
